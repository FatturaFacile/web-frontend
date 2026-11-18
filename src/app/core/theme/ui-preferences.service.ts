import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal, WritableSignal } from '@angular/core';
import { UiPreferencesApiService } from '../api/ui-preferences-api.service';
import { isHexColor } from './contrast.util';
import {
  DEFAULT_TENANT_BRANDING,
  TenantBranding,
  THEME_PREFERENCES,
  ThemePreference,
  UI_DENSITIES,
  UiDensity,
  UserUiPreferences,
} from './ui-preferences.types';

/** The cache the inline script of index.html reads before Angular starts, so the first paint is already themed. */
export const UI_STORAGE_KEY = 'ff_ui';

interface StoredUi {
  theme: ThemePreference;
  density: UiDensity;
  reducedMotion: boolean | null;
  branding: TenantBranding;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function colourOrNull(value: unknown): string | null {
  return typeof value === 'string' && isHexColor(value) ? value : null;
}

/**
 * Theme, density and motion preferences of the user and the branding of the tenant, as signals.
 *
 * Every change is written at once to localStorage (the first paint of the next visit needs no network) and, once the
 * user is signed in, sent to `/user/preferences`. The server copy wins when it is loaded after the sign-in.
 */
@Service()
export class UiPreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(UiPreferencesApiService, { optional: true });

  private readonly themeSignal = signal<ThemePreference>('system');
  private readonly densitySignal = signal<UiDensity>('comfortable');
  private readonly reducedMotionSignal = signal<boolean | null>(null);
  private readonly brandingSignal = signal<TenantBranding>(DEFAULT_TENANT_BRANDING);
  private readonly systemDarkSignal = signal(false);
  private readonly systemReducedMotionSignal = signal(false);
  private remote = false;

  readonly themePreference = this.themeSignal.asReadonly();
  readonly density = this.densitySignal.asReadonly();
  readonly reducedMotionPreference = this.reducedMotionSignal.asReadonly();
  readonly branding = this.brandingSignal.asReadonly();

  /**
   * The theme in force. `system` of the user means "my organisation's choice": the tenant default when it is light
   * or dark, otherwise the operating system.
   */
  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    let preference = this.themeSignal();
    if (preference === 'system') {
      preference = this.brandingSignal().default_theme;
    }
    if (preference === 'system') {
      return this.systemDarkSignal() ? 'dark' : 'light';
    }
    return preference;
  });
  readonly isDark = computed(() => this.resolvedTheme() === 'dark');
  readonly reducedMotion = computed(
    () => this.reducedMotionSignal() ?? this.systemReducedMotionSignal(),
  );

  constructor() {
    this.restore();
    this.watchMedia('(prefers-color-scheme: dark)', this.systemDarkSignal);
    this.watchMedia('(prefers-reduced-motion: reduce)', this.systemReducedMotionSignal);
  }

  setTheme(theme: ThemePreference): void {
    this.themeSignal.set(theme);
    this.persist();
    this.pushUser({ theme_preference: theme });
  }

  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setDensity(density: UiDensity): void {
    this.densitySignal.set(density);
    this.persist();
    this.pushUser({ ui_density: density });
  }

  setReducedMotion(reducedMotion: boolean | null): void {
    this.reducedMotionSignal.set(reducedMotion);
    this.persist();
    this.pushUser({ reduced_motion: reducedMotion });
  }

  /** Applies a branding received from the API or edited by an administrator (not sent back). */
  applyBranding(branding: TenantBranding): void {
    if (!isPlainObject(branding)) {
      return;
    }
    this.brandingSignal.set({
      brand_primary_color: colourOrNull(branding.brand_primary_color),
      brand_secondary_color: colourOrNull(branding.brand_secondary_color),
      brand_logo_url: branding.brand_logo_url,
      default_theme: isOneOf(THEME_PREFERENCES, branding.default_theme)
        ? branding.default_theme
        : 'system',
    });
    this.persist();
  }

  /** The signed-in state: only then are the changes sent to the API. */
  setRemoteEnabled(enabled: boolean): void {
    this.remote = enabled;
  }

  /** Loads both resources; a failure keeps the local values (the interface never blocks on the network). */
  loadRemote(): void {
    this.api?.getUserPreferences().subscribe({
      next: (res) => this.applyUser(res.data),
      error: () => undefined,
    });
    this.api?.getTenantBranding().subscribe({
      next: (res) => this.applyBranding(res.data),
      error: () => undefined,
    });
  }

  /** Only valid fields are applied: an empty or malformed response keeps the values already in force. */
  private applyUser(prefs: Partial<UserUiPreferences> | null | undefined): void {
    if (!isPlainObject(prefs)) {
      return;
    }
    if (isOneOf(THEME_PREFERENCES, prefs.theme_preference)) {
      this.themeSignal.set(prefs.theme_preference);
    }
    if (isOneOf(UI_DENSITIES, prefs.ui_density)) {
      this.densitySignal.set(prefs.ui_density);
    }
    if (typeof prefs.reduced_motion === 'boolean' || prefs.reduced_motion === null) {
      this.reducedMotionSignal.set(prefs.reduced_motion);
    }
    this.persist();
  }

  private pushUser(payload: Partial<UserUiPreferences>): void {
    if (this.remote) {
      this.api?.updateUserPreferences(payload).subscribe({ error: () => undefined });
    }
  }

  private persist(): void {
    const stored: StoredUi = {
      theme: this.themeSignal(),
      density: this.densitySignal(),
      reducedMotion: this.reducedMotionSignal(),
      branding: this.brandingSignal(),
    };
    try {
      this.storage()?.setItem(UI_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Private mode or a full quota: the preference lasts for this session only.
    }
  }

  private restore(): void {
    const storage = this.storage();
    if (!storage) {
      return;
    }
    try {
      const raw = storage.getItem(UI_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredUi>;
        if (isOneOf(THEME_PREFERENCES, parsed.theme)) {
          this.themeSignal.set(parsed.theme);
        }
        if (isOneOf(UI_DENSITIES, parsed.density)) {
          this.densitySignal.set(parsed.density);
        }
        this.reducedMotionSignal.set(
          typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : null,
        );
        if (parsed.branding) {
          this.applyBranding({ ...DEFAULT_TENANT_BRANDING, ...parsed.branding });
        }
        return;
      }
      // Before this cache the choice was a bare light/dark value.
      const legacy = storage.getItem('theme') ?? storage.getItem('ff_theme');
      if (legacy === 'light' || legacy === 'dark') {
        this.themeSignal.set(legacy);
      }
      const legacyDensity = storage.getItem('ff-density');
      if (isOneOf(UI_DENSITIES, legacyDensity)) {
        this.densitySignal.set(legacyDensity);
      }
    } catch {
      // A damaged cache is ignored: the defaults apply.
    }
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private watchMedia(query: string, target: WritableSignal<boolean>): void {
    const view = this.document.defaultView;
    if (!view || typeof view.matchMedia !== 'function') {
      return;
    }
    const media = view.matchMedia(query);
    target.set(media.matches);
    media.addEventListener?.('change', (event) => target.set(event.matches));
  }
}
