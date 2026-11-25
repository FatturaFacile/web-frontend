import { describe, expect, it } from 'vitest';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { routes } from '../../app.routes';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { INTERCOMPANY_ROUTES } from './intercompany.routes';

describe('INTERCOMPANY_ROUTES', () => {
  const pages = INTERCOMPANY_ROUTES[0].children ?? [];

  it('opens the group structure first, then the four working pages', () => {
    expect(pages.map((route) => route.path)).toEqual([
      '',
      'transactions',
      'reconciliation',
      'consolidation',
      'statements',
    ]);
  });

  it('lazy loads the shell and a standalone component for every page', async () => {
    expect(await (INTERCOMPANY_ROUTES[0].loadComponent as () => Promise<unknown>)()).toBeTruthy();
    for (const route of pages) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      expect(await (route.loadComponent as () => Promise<unknown>)(), route.path).toBeTruthy();
    }
  });

  it('gives each page a breadcrumb and a title served by the translation seeders', () => {
    for (const route of pages) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.INTERCOMPANY_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.INTERCOMPANY_/);
    }
  });
});

describe('intercompany route of the application', () => {
  it('is guarded by the module, the menu and the feature flag', () => {
    const route = routes.find((candidate) => candidate.path === 'intercompany');

    expect(route).toBeDefined();
    expect(route?.canActivate).toHaveLength(4);
    expect(route?.loadChildren).toBeTypeOf('function');
    expect(PREMATURE_OPEN_ISSUE_MODULES['intercompany']).toEqual({
      issue: 291,
      routePrefix: '/intercompany',
    });
  });

  it('has a sidebar entry with a link to each page', () => {
    const entries = MENU_SECTIONS.flatMap((section) => section.items ?? []).filter(
      (item) => item.module === 'intercompany',
    );
    const links = entries.flatMap((entry) => entry.children ?? []).map((child) => child.route);

    expect(entries.length).toBeGreaterThan(0);
    expect(links).toEqual([
      '/intercompany',
      '/intercompany/transactions',
      '/intercompany/reconciliation',
      '/intercompany/consolidation',
      '/intercompany/statements',
    ]);
  });
});
