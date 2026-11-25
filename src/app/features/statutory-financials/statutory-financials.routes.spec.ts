import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { STATUTORY_FINANCIALS_ROUTES, WORKSPACE_TABS } from './statutory-financials.routes';
import { STATUTORY_FINANCIALS_MODULE } from './statutory-financials.util';

describe('statutory financials routes', () => {
  it('declares the list, the wizard and the workspace with a breadcrumb, a title key and a lazy component', () => {
    expect(STATUTORY_FINANCIALS_ROUTES.map((route) => route.path)).toEqual(['', 'new', ':id']);

    for (const route of STATUTORY_FINANCIALS_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^statutoryFinancials\./);
      expect(route.data?.['title'], route.path).toMatch(/^statutoryFinancials\./);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });

  it('gives the workspace one lazy child per tab and opens the statements first', () => {
    const workspace = STATUTORY_FINANCIALS_ROUTES.find((route) => route.path === ':id');
    const children = workspace?.children ?? [];

    expect(children[0]).toMatchObject({ path: '', redirectTo: 'statements', pathMatch: 'full' });
    expect(children.slice(1).map((route) => route.path)).toEqual([...WORKSPACE_TABS]);
    for (const route of children.slice(1)) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      expect(route.data?.['title'], route.path).toMatch(/^statutoryFinancials\.tab\./);
    }
  });

  it('provides the workspace store at the workspace route so the tabs share it', () => {
    const workspace = STATUTORY_FINANCIALS_ROUTES.find((route) => route.path === ':id');
    expect(workspace?.providers?.length).toBe(1);
  });
});

describe('statutory financials navigation and access', () => {
  const entry = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'statutoryFinancials.nav.title',
  );

  it('has a menu entry guarded by the module', () => {
    expect(entry?.route).toBe('/statutory-financials');
    expect(entry?.module).toBe(STATUTORY_FINANCIALS_MODULE);
    expect(isUrlOfEnabledMenuRoute('/statutory-financials')).toBe(true);
    expect(moduleOfUrl('/statutory-financials')).toBe(STATUTORY_FINANCIALS_MODULE);
  });

  it('puts the module behind its feature flag', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['statutory_financials']).toEqual({
      issue: 413,
      routePrefix: '/statutory-financials',
    });
  });

  it('lets finance roles write, auditors read and nobody else in', () => {
    const read = (roles: string[]) =>
      canAccessModule(STATUTORY_FINANCIALS_MODULE, 'read', roles, []);
    const write = (roles: string[]) =>
      canAccessModule(STATUTORY_FINANCIALS_MODULE, 'write', roles, []);

    for (const role of ['owner', 'admin', 'accountant']) {
      expect(read([role]), role).toBe(true);
      expect(write([role]), role).toBe(true);
    }
    expect(read(['accountant_readonly'])).toBe(true);
    expect(write(['accountant_readonly'])).toBe(false);
    expect(read(['sales'])).toBe(false);
    expect(
      canAccessModule(
        STATUTORY_FINANCIALS_MODULE,
        'write',
        ['sales'],
        ['statutory_financials.write'],
      ),
    ).toBe(true);
  });
});
