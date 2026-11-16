import { DOCUMENT } from '@angular/common';
import { effect, inject, Service, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import {
  BRAND_STORAGE_KEY,
  BrandColours,
  brandVariables,
  brandVariablesForBothThemes,
  CssVariables,
} from './brand-theme';
import { UiPreferencesService } from './ui-preferences.service';

const DARK_STYLESHEET_ID = 'theme-dark-stylesheet';
// Browser chrome colours (meta theme-color) must be literals: the browser does not resolve CSS variables there.
const THEME_COLOR: Record<'light' | 'dark', string> = { light: '#0f766e', dark: '#0b1120' };

/**
 * Puts the UI preferences on the page: `data-theme`, `data-density` and `data-reduced-motion` on <html>, the dark
 * NG-ZORRO stylesheet (added only while the dark theme is active) and the brand colours of the tenant as CSS
 * custom properties. The inline script ff-theme-init.js does the same from the cache before Angular starts, so the
 * first paint is already right; this service keeps it right afterwards and syncs with the API once signed in.
 */
@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly authStore = inject(AuthStore);
  private readonly prefs = inject(UiPreferencesService);
  private appliedVariables: string[] = [];

  constructor() {
    effect(() => this.applyTheme(this.prefs.resolvedTheme()));
    effect(() => this.applyDensity(this.prefs.density()));
    effect(() => this.applyMotion(this.prefs.reducedMotion()));
    effect(() => this.applyBrand(this.prefs.branding(), this.prefs.resolvedTheme()));
    effect(() => this.cacheBrand(this.prefs.branding()));

    effect(() => {
      const signedIn = this.authStore.isAuthenticated();
      // A tenant switch has another branding: read it again.
      const tenantId = this.authStore.activeTenantId();
      untracked(() => {
        this.prefs.setRemoteEnabled(signedIn);
        if (signedIn && tenantId) {
          this.prefs.loadRemote();
        }
      });
    });
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    const root = this.document.documentElement;
    const dark = theme === 'dark';
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', dark);
    root.style.colorScheme = theme;
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);

    const existing = this.document.getElementById(DARK_STYLESHEET_ID);
    if (dark && !existing) {
      const link = this.document.createElement('link');
      link.id = DARK_STYLESHEET_ID;
      link.rel = 'stylesheet';
      link.href = 'theme-dark.css';
      this.document.head.appendChild(link);
    } else if (!dark && existing) {
      existing.remove();
    }
  }

  private applyDensity(density: string): void {
    this.document.documentElement.setAttribute('data-density', density);
  }

  private applyMotion(reduced: boolean): void {
    this.document.documentElement.setAttribute('data-reduced-motion', String(reduced));
  }

  private applyBrand(branding: BrandColours, theme: 'light' | 'dark'): void {
    const style = this.document.documentElement.style;
    for (const name of this.appliedVariables) {
      style.removeProperty(name);
    }
    const variables: CssVariables = brandVariables(branding, theme);
    this.appliedVariables = Object.keys(variables);
    for (const [name, value] of Object.entries(variables)) {
      style.setProperty(name, value);
    }
  }

  /** The inline script of index.html applies these before the first paint. */
  private cacheBrand(branding: BrandColours): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        BRAND_STORAGE_KEY,
        JSON.stringify(brandVariablesForBothThemes(branding)),
      );
    } catch {
      // No storage: the brand is applied after Angular starts.
    }
  }
}
