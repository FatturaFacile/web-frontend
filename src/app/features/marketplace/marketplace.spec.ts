import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { MARKETPLACE_ROUTES } from './marketplace.routes';
import { apiErrorText, HEALTH_COLORS, INSTALLATION_STATUS_COLORS, RUN_STATUS_COLORS } from './marketplace.util';

describe('marketplace screens', () => {
  it('every route loads its standalone component', async () => {
    for (const route of MARKETPLACE_ROUTES) {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
    expect(MARKETPLACE_ROUTES.map((route) => route.path)).toEqual(['', 'installations', 'installations/:id', 'runs']);
  });

  it('shows the first validation message of a 422', () => {
    const validation = new HttpErrorResponse({ status: 422, error: { errors: { settings: ['Settings invalid'] } } });
    expect(apiErrorText(validation)).toBe('Settings invalid');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('colours every status the API can return', () => {
    expect(Object.keys(INSTALLATION_STATUS_COLORS)).toEqual(['pending_configuration', 'disabled', 'enabled']);
    expect(Object.keys(HEALTH_COLORS)).toEqual(['unknown', 'healthy', 'degraded', 'unhealthy']);
    expect(Object.keys(RUN_STATUS_COLORS)).toEqual(['running', 'succeeded', 'failed', 'rate_limited']);
  });
});
