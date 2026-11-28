import { describe, expect, it } from 'vitest';
import { WITHHOLDING_RECIPIENTS_ROUTES } from './withholding-recipients.routes';

describe('WITHHOLDING_RECIPIENTS_ROUTES', () => {
  it('opens the pages of the module, the dashboard first', () => {
    expect(WITHHOLDING_RECIPIENTS_ROUTES.map((route) => route.path)).toEqual([
      '',
      'simulator',
      'settlements',
    ]);
  });

  it('lazy loads a standalone component for every page', async () => {
    for (const route of WITHHOLDING_RECIPIENTS_ROUTES) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component, route.path).toBeTruthy();
    }
  });

  it('gives each page a breadcrumb and a page title key', () => {
    for (const route of WITHHOLDING_RECIPIENTS_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.WITHHOLDING_RECIPIENTS_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.WITHHOLDING_RECIPIENTS_/);
    }
  });

  it('guards no page of its own: the settle ability is checked inside the settlement center', () => {
    expect(WITHHOLDING_RECIPIENTS_ROUTES.every((route) => !route.canActivate)).toBe(true);
  });
});
