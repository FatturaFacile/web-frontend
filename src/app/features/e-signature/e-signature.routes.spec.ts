import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { routes } from '../../app.routes';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { E_SIGNATURE_ROUTES } from './e-signature.routes';
import { ESIG_CONFIGURE_MODULE, ESIG_MODULE } from './e-signature.util';

describe('E_SIGNATURE_ROUTES', () => {
  it('opens the signature center first and the settings second', () => {
    expect(E_SIGNATURE_ROUTES.map((route) => route.path)).toEqual(['', 'settings']);
  });

  it('lazy loads a standalone component for every page', async () => {
    for (const route of E_SIGNATURE_ROUTES) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      expect(await (route.loadComponent as () => Promise<unknown>)(), route.path).toBeTruthy();
    }
  });

  it('gives each page a breadcrumb and a page title key', () => {
    for (const route of E_SIGNATURE_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.SIGNATURES_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.SIGNATURES_/);
    }
  });

  it('guards only the settings page with the configure ability', () => {
    expect(
      E_SIGNATURE_ROUTES.filter((route) => (route.canActivate ?? []).length > 0).map(
        (route) => route.path,
      ),
    ).toEqual(['settings']);
  });
});

describe('electronic signature routes of the application', () => {
  it('guards the staff pages with the module and the feature flag', () => {
    const staff = routes.find((route) => route.path === 'signatures');

    expect(staff?.canActivate).toHaveLength(4);
    expect(staff?.loadChildren).toBeTypeOf('function');
  });

  it('serves the signer portal and the verification page without a guard and without the application shell', () => {
    for (const path of ['sign/:token', 'verify-signature']) {
      const route = routes.find((candidate) => candidate.path === path);

      expect(route, path).toBeDefined();
      expect(route?.canActivate, path).toBeUndefined();
      expect(route?.data?.['publicPage'], path).toBe(true);
    }
  });
});

describe('electronic signature navigation and access', () => {
  const group = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.SIGNATURES',
  );

  it('has a menu group with the center and the settings', () => {
    expect(group?.module).toBe(ESIG_MODULE);
    expect(group?.children?.map((child) => child.route)).toEqual([
      '/signatures',
      '/signatures/settings',
    ]);
    expect(group?.children?.map((child) => child.key)).toEqual([
      'NAV.SIGNATURES_CENTER',
      'NAV.SIGNATURES_SETTINGS',
    ]);
  });

  it('opens both pages from the menu and guards them with their module', () => {
    expect(isUrlOfEnabledMenuRoute('/signatures')).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/signatures/settings')).toBe(true);
    expect(moduleOfUrl('/signatures')).toBe(ESIG_MODULE);
    expect(moduleOfUrl('/signatures/settings')).toBe(ESIG_CONFIGURE_MODULE);
  });

  it('puts the module behind its feature flag', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['electronic_signature']).toEqual({
      issue: 211,
      routePrefix: '/signatures',
    });
  });

  it('lets every member read and the business roles start a signature', () => {
    expect(canAccessModule(ESIG_MODULE, 'read', ['member'], [])).toBe(true);
    for (const role of ['owner', 'admin', 'accountant', 'sales', 'sales_manager', 'hr', 'member']) {
      expect(canAccessModule(ESIG_MODULE, 'write', [role], []), role).toBe(true);
    }
    expect(canAccessModule(ESIG_MODULE, 'write', ['accountant_readonly'], [])).toBe(false);
    expect(
      canAccessModule(
        ESIG_MODULE,
        'write',
        ['accountant_readonly'],
        ['electronic_signature.write'],
      ),
    ).toBe(true);
  });

  it('keeps the provider settings to owners and administrators', () => {
    for (const role of ['owner', 'admin']) {
      expect(canAccessModule(ESIG_CONFIGURE_MODULE, 'write', [role], []), role).toBe(true);
    }
    for (const role of ['accountant', 'sales_manager', 'member']) {
      expect(canAccessModule(ESIG_CONFIGURE_MODULE, 'read', [role], []), role).toBe(false);
    }
  });
});
