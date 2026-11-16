import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiPreferencesApiService } from '../api/ui-preferences-api.service';
import { UI_STORAGE_KEY, UiPreferencesService } from './ui-preferences.service';
import { DEFAULT_TENANT_BRANDING } from './ui-preferences.types';

function mockMedia(matches: { dark?: boolean; reduce?: boolean }): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-color-scheme') ? !!matches.dark : !!matches.reduce,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('UiPreferencesService', () => {
  const api = {
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
    getTenantBranding: vi.fn(),
    updateTenantBranding: vi.fn(),
  };

  function create(): UiPreferencesService {
    TestBed.configureTestingModule({
      providers: [{ provide: UiPreferencesApiService, useValue: api }],
    });
    return TestBed.inject(UiPreferencesService);
  }

  beforeEach(() => {
    localStorage.clear();
    mockMedia({});
    Object.values(api).forEach((fn) => fn.mockReset());
    api.updateUserPreferences.mockReturnValue(of({ data: {} }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with the system theme, comfortable density and no brand', () => {
    const prefs = create();
    expect(prefs.themePreference()).toBe('system');
    expect(prefs.density()).toBe('comfortable');
    expect(prefs.reducedMotionPreference()).toBeNull();
    expect(prefs.branding()).toEqual(DEFAULT_TENANT_BRANDING);
    expect(prefs.resolvedTheme()).toBe('light');
  });

  it('follows prefers-color-scheme while the preference is system', () => {
    mockMedia({ dark: true });
    expect(create().resolvedTheme()).toBe('dark');
  });

  it('lets an explicit choice win over the operating system', () => {
    mockMedia({ dark: true });
    const prefs = create();
    prefs.setTheme('light');
    expect(prefs.resolvedTheme()).toBe('light');
  });

  it('uses the tenant default theme when the user has no choice of their own', () => {
    mockMedia({ dark: false });
    const prefs = create();
    prefs.applyBranding({ ...DEFAULT_TENANT_BRANDING, default_theme: 'dark' });
    expect(prefs.resolvedTheme()).toBe('dark');
    prefs.setTheme('light');
    expect(prefs.resolvedTheme()).toBe('light');
  });

  it('follows prefers-reduced-motion unless the user decided', () => {
    mockMedia({ reduce: true });
    const prefs = create();
    expect(prefs.reducedMotion()).toBe(true);
    prefs.setReducedMotion(false);
    expect(prefs.reducedMotion()).toBe(false);
    prefs.setReducedMotion(null);
    expect(prefs.reducedMotion()).toBe(true);
  });

  it('writes every change to localStorage at once and restores it', () => {
    const first = create();
    first.setTheme('dark');
    first.setDensity('compact');
    first.setReducedMotion(true);
    first.applyBranding({ ...DEFAULT_TENANT_BRANDING, brand_primary_color: '#1F6FEB' });

    expect(JSON.parse(localStorage.getItem(UI_STORAGE_KEY) as string)).toMatchObject({
      theme: 'dark',
      density: 'compact',
      reducedMotion: true,
      branding: { brand_primary_color: '#1F6FEB' },
    });

    TestBed.resetTestingModule();
    const second = create();
    expect(second.themePreference()).toBe('dark');
    expect(second.density()).toBe('compact');
    expect(second.reducedMotionPreference()).toBe(true);
    expect(second.branding().brand_primary_color).toBe('#1F6FEB');
  });

  it('migrates the old bare theme key and ignores a damaged cache', () => {
    localStorage.setItem('theme', 'dark');
    expect(create().themePreference()).toBe('dark');

    TestBed.resetTestingModule();
    localStorage.clear();
    localStorage.setItem(UI_STORAGE_KEY, '{not json');
    expect(create().themePreference()).toBe('system');
  });

  it('drops colours that are not six-digit hex values', () => {
    const prefs = create();
    prefs.applyBranding({
      ...DEFAULT_TENANT_BRANDING,
      brand_primary_color: 'red',
      brand_secondary_color: '#FFF',
    });
    expect(prefs.branding().brand_primary_color).toBeNull();
    expect(prefs.branding().brand_secondary_color).toBeNull();
  });

  it('sends changes to the API only while signed in', () => {
    const prefs = create();
    prefs.setDensity('spacious');
    expect(api.updateUserPreferences).not.toHaveBeenCalled();

    prefs.setRemoteEnabled(true);
    prefs.setDensity('compact');
    prefs.setTheme('dark');
    expect(api.updateUserPreferences).toHaveBeenNthCalledWith(1, { ui_density: 'compact' });
    expect(api.updateUserPreferences).toHaveBeenNthCalledWith(2, { theme_preference: 'dark' });
  });

  it('loads the server copy of the preferences and the branding', () => {
    api.getUserPreferences.mockReturnValue(
      of({ data: { theme_preference: 'dark', ui_density: 'spacious', reduced_motion: true } }),
    );
    api.getTenantBranding.mockReturnValue(
      of({
        data: {
          ...DEFAULT_TENANT_BRANDING,
          brand_primary_color: '#0F766E',
          default_theme: 'light',
        },
      }),
    );
    const prefs = create();
    prefs.loadRemote();

    expect(prefs.themePreference()).toBe('dark');
    expect(prefs.density()).toBe('spacious');
    expect(prefs.reducedMotionPreference()).toBe(true);
    expect(prefs.branding().brand_primary_color).toBe('#0F766E');
  });

  it('keeps the local values when the API fails', () => {
    api.getUserPreferences.mockReturnValue(throwError(() => new Error('offline')));
    api.getTenantBranding.mockReturnValue(throwError(() => new Error('offline')));
    const prefs = create();
    prefs.setDensity('compact');
    prefs.loadRemote();
    expect(prefs.density()).toBe('compact');
  });

  it('ignores unknown values received from the API', () => {
    api.getUserPreferences.mockReturnValue(
      of({ data: { theme_preference: 'neon', ui_density: 'tiny', reduced_motion: 'yes' } }),
    );
    api.getTenantBranding.mockReturnValue(of({ data: DEFAULT_TENANT_BRANDING }));
    const prefs = create();
    prefs.loadRemote();
    expect(prefs.themePreference()).toBe('system');
    expect(prefs.density()).toBe('comfortable');
    expect(prefs.reducedMotionPreference()).toBeNull();
  });
});
