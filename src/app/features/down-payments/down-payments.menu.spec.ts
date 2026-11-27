import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { DOWN_PAYMENTS_MODULE } from './down-payments.util';

describe('down payments navigation', () => {
  const entry = MENU_SECTIONS.flatMap((section) => section.items)
    .flatMap((item) => item.children ?? [])
    .find((child) => child.key === 'NAV.DOWN_PAYMENTS_CHAINS');

  it('has a menu entry in the sales group, guarded by the module', () => {
    expect(entry?.route).toBe('/down-payments/chains');
    expect(entry?.module).toBe(DOWN_PAYMENTS_MODULE);
  });

  it('opens the list and the detail of a chain from the menu, guarded by the module', () => {
    for (const page of [
      '/down-payments/chains',
      '/down-payments/chains/0b0a2c52-6f4e-4a39-8b1f-0d5d7a6c0a11',
    ]) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
      expect(moduleOfUrl(page), page).toBe(DOWN_PAYMENTS_MODULE);
    }
  });

  it('puts the module behind its feature flag, as the other tracked modules', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['down_payments']).toEqual({
      issue: 449,
      routePrefix: '/down-payments',
    });
  });
});

describe('down payments access', () => {
  it('lets finance and sales read, and finance and the sales manager write', () => {
    for (const role of ['owner', 'admin', 'accountant', 'sales', 'sales_manager']) {
      expect(canAccessModule(DOWN_PAYMENTS_MODULE, 'read', [role]), role).toBe(true);
    }
    for (const role of ['owner', 'admin', 'accountant', 'sales_manager']) {
      expect(canAccessModule(DOWN_PAYMENTS_MODULE, 'write', [role]), role).toBe(true);
    }
    expect(canAccessModule(DOWN_PAYMENTS_MODULE, 'write', ['sales'])).toBe(false);
    expect(canAccessModule(DOWN_PAYMENTS_MODULE, 'read', ['warehouse'])).toBe(false);
  });

  it('opens the module with the fine-grained permissions of the API', () => {
    expect(canAccessModule(DOWN_PAYMENTS_MODULE, 'read', ['member'], ['down_payments.view'])).toBe(
      true,
    );
    expect(
      canAccessModule(DOWN_PAYMENTS_MODULE, 'write', ['member'], ['down_payments.settle']),
    ).toBe(true);
    expect(canAccessModule(DOWN_PAYMENTS_MODULE, 'write', ['member'], ['down_payments.view'])).toBe(
      false,
    );
  });
});
