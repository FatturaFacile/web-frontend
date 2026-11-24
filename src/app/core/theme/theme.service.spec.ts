import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiPreferencesApiService } from '../api/ui-preferences-api.service';
import { AuthStore } from '../auth/auth.store';
import { BRAND_STORAGE_KEY } from './brand-theme';
import { ThemeService } from './theme.service';
import { UiPreferencesService } from './ui-preferences.service';
import { DEFAULT_TENANT_BRANDING } from './ui-preferences.types';

describe('ThemeService', () => {
  const isAuthenticated = signal(false);
  const activeTenantId = signal('tenant-1');
  const api = {
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
    getTenantBranding: vi.fn(),
    updateTenantBranding: vi.fn(),
  };
  const root = document.documentElement;

  function create(): { theme: ThemeService; prefs: UiPreferencesService } {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { isAuthenticated, activeTenantId } },
        { provide: UiPreferencesApiService, useValue: api },
      ],
    });
    const prefs = TestBed.inject(UiPreferencesService);
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    return { theme, prefs };
  }

  beforeEach(() => {
    localStorage.clear();
    isAuthenticated.set(false);
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getUserPreferences.mockReturnValue(
      of({ data: { theme_preference: 'system', ui_density: 'comfortable', reduced_motion: null } }),
    );
    api.getTenantBranding.mockReturnValue(of({ data: DEFAULT_TENANT_BRANDING }));
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-density');
    root.removeAttribute('data-reduced-motion');
    root.removeAttribute('style');
    root.classList.remove('dark');
    document.getElementById('theme-dark-stylesheet')?.remove();
  });

  it('sets theme, density and motion attributes on <html>', () => {
    const { prefs } = create();
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-density')).toBe('comfortable');
    expect(root.getAttribute('data-reduced-motion')).toBe('false');
    expect(root.style.colorScheme).toBe('light');

    prefs.setTheme('dark');
    prefs.setDensity('compact');
    prefs.setReducedMotion(true);
    TestBed.tick();

    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.getAttribute('data-density')).toBe('compact');
    expect(root.getAttribute('data-reduced-motion')).toBe('true');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('adds the dark NG-ZORRO stylesheet only while the dark theme is active, once', () => {
    const { prefs } = create();
    expect(document.getElementById('theme-dark-stylesheet')).toBeNull();

    prefs.setTheme('dark');
    TestBed.tick();
    expect(document.querySelectorAll('#theme-dark-stylesheet')).toHaveLength(1);

    prefs.setTheme('light');
    TestBed.tick();
    expect(document.getElementById('theme-dark-stylesheet')).toBeNull();
  });

  it('injects brand variables per theme and removes them when the brand is cleared', () => {
    const { prefs } = create();
    prefs.applyBranding({
      ...DEFAULT_TENANT_BRANDING,
      brand_primary_color: '#1F6FEB',
      brand_secondary_color: '#F59E0B',
    });
    TestBed.tick();

    const lightPrimary = root.style.getPropertyValue('--ff-color-primary');
    expect(lightPrimary).toMatch(/^#[0-9A-F]{6}$/);
    expect(root.style.getPropertyValue('--ff-color-on-primary')).not.toBe('');
    expect(root.style.getPropertyValue('--ff-color-primary-hover')).not.toBe('');
    expect(root.style.getPropertyValue('--ff-color-primary-active')).not.toBe('');
    expect(root.style.getPropertyValue('--ff-color-primary-subtle')).not.toBe('');
    expect(root.style.getPropertyValue('--ff-color-accent')).not.toBe('');

    prefs.setTheme('dark');
    TestBed.tick();
    expect(root.style.getPropertyValue('--ff-color-primary')).not.toBe(lightPrimary);

    prefs.applyBranding(DEFAULT_TENANT_BRANDING);
    TestBed.tick();
    expect(root.style.getPropertyValue('--ff-color-primary')).toBe('');
    expect(root.style.getPropertyValue('--ff-color-accent')).toBe('');
  });

  it('caches the brand variables of both themes for the first paint', () => {
    const { prefs } = create();
    prefs.applyBranding({ ...DEFAULT_TENANT_BRANDING, brand_primary_color: '#1F6FEB' });
    TestBed.tick();

    const cached = JSON.parse(localStorage.getItem(BRAND_STORAGE_KEY) as string) as Record<
      string,
      Record<string, string>
    >;
    expect(Object.keys(cached)).toEqual(['light', 'dark']);
    expect(cached['light']['--ff-color-primary']).toMatch(/^#[0-9A-F]{6}$/);
    expect(cached['dark']['--ff-color-primary']).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('syncs with the API once signed in and again after a tenant switch', () => {
    create();
    expect(api.getTenantBranding).not.toHaveBeenCalled();

    isAuthenticated.set(true);
    TestBed.tick();
    expect(api.getTenantBranding).toHaveBeenCalledTimes(1);
    expect(api.getUserPreferences).toHaveBeenCalledTimes(1);

    activeTenantId.set('tenant-2');
    TestBed.tick();
    expect(api.getTenantBranding).toHaveBeenCalledTimes(2);
  });
});
