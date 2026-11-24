import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AGENT_COMMISSIONS_ROUTES } from './agent-commissions.routes';

describe('AGENT_COMMISSIONS_ROUTES', () => {
  it('opens the pages of the module, the agents first', () => {
    expect(AGENT_COMMISSIONS_ROUTES.map((route) => route.path)).toEqual([
      '',
      'rules',
      'ledger',
      'enasarco',
      'statements',
      'exports',
      'settings',
    ]);
  });

  it('lazy loads a standalone component for every page', async () => {
    for (const route of AGENT_COMMISSIONS_ROUTES) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component, route.path).toBeTruthy();
    }
  });

  it('gives each page a breadcrumb and a page title key', () => {
    for (const route of AGENT_COMMISSIONS_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.AGENT_COMMISSIONS_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.AGENT_COMMISSIONS_/);
    }
  });

  it('guards only the exports page with the settle ability', () => {
    const guarded = AGENT_COMMISSIONS_ROUTES.filter(
      (route: Route) => (route.canActivate ?? []).length > 0,
    );

    expect(guarded.map((route) => route.path)).toEqual(['exports']);
  });
});
