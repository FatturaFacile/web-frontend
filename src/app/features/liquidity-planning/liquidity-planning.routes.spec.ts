import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { LIQUIDITY_PLANNING_ROUTES } from './liquidity-planning.routes';
import { LP_MODULE } from './liquidity-planning.util';

function leaves(routes: Route[]): Route[] {
  return routes.flatMap((route) => (route.children ? leaves(route.children) : [route]));
}

describe('liquidity planning routes', () => {
  it('lazy loads the workspace and the report', async () => {
    const pages = leaves(LIQUIDITY_PLANNING_ROUTES);

    expect(pages.map((route) => route.path)).toEqual(['', 'report']);
    for (const page of pages) {
      expect(typeof page.loadComponent).toBe('function');
      expect(await (page.loadComponent as () => Promise<unknown>)()).toBeDefined();
    }
  });

  it('shares one store between the pages', () => {
    expect(LIQUIDITY_PLANNING_ROUTES[0].providers).toHaveLength(1);
  });
});

describe('liquidity planning navigation', () => {
  const entry = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.LIQUIDITY_PLANNING',
  );

  it('has a menu entry guarded by the module', () => {
    expect(entry?.route).toBe('/liquidity-planning');
    expect(entry?.module).toBe(LP_MODULE);
  });

  it('opens the workspace and the report from the menu', () => {
    for (const url of ['/liquidity-planning', '/liquidity-planning/report']) {
      expect(isUrlOfEnabledMenuRoute(url), url).toBe(true);
      expect(moduleOfUrl(url), url).toBe(LP_MODULE);
    }
  });

  it('lets finance plan and the read-only accountant read', () => {
    expect(canAccessModule(LP_MODULE, 'read', ['accountant_readonly'])).toBe(true);
    expect(canAccessModule(LP_MODULE, 'write', ['accountant_readonly'])).toBe(false);
    expect(canAccessModule(LP_MODULE, 'write', ['accountant'])).toBe(true);
    expect(canAccessModule(LP_MODULE, 'read', ['warehouse'])).toBe(false);
  });
});
