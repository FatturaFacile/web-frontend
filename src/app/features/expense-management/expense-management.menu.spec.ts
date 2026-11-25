import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import {
  EXPENSE_MANAGEMENT_FINANCE_MODULE,
  EXPENSE_MANAGEMENT_MODULE,
} from './expense-management.util';

const PAGES = [
  '/expense-management',
  '/expense-management/workbench',
  '/expense-management/cards',
  '/expense-management/violations',
];

describe('expense management navigation', () => {
  const group = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.EXPENSE_MANAGEMENT',
  );

  it('has a menu group with the four pages, each with a translated name', () => {
    expect(group?.module).toBe(EXPENSE_MANAGEMENT_MODULE);
    expect(group?.children?.map((child) => child.route)).toEqual(PAGES);
    expect(group?.children?.map((child) => child.key)).toEqual([
      'NAV.EXPENSE_MANAGEMENT_REPORTS',
      'NAV.EXPENSE_MANAGEMENT_WORKBENCH',
      'NAV.EXPENSE_MANAGEMENT_CARDS',
      'NAV.EXPENSE_MANAGEMENT_VIOLATIONS',
    ]);
  });

  it('opens every page from the menu', () => {
    for (const page of PAGES) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
    }
  });

  it('guards the cards page with the finance ability and the others with the module', () => {
    expect(moduleOfUrl('/expense-management/cards')).toBe(EXPENSE_MANAGEMENT_FINANCE_MODULE);
    for (const page of PAGES.filter((route) => route !== '/expense-management/cards')) {
      expect(moduleOfUrl(page), page).toBe(EXPENSE_MANAGEMENT_MODULE);
    }
  });

  it('puts the module behind its feature flag, as the other tracked modules', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['expense_management']).toEqual({
      issue: 166,
      routePrefix: '/expense-management',
    });
  });
});

describe('expense management access', () => {
  it('lets every member file expense reports', () => {
    for (const role of ['owner', 'member', 'sales', 'warehouse']) {
      expect(canAccessModule(EXPENSE_MANAGEMENT_MODULE, 'read', [role]), role).toBe(true);
      expect(canAccessModule(EXPENSE_MANAGEMENT_MODULE, 'write', [role]), role).toBe(true);
    }
  });

  it('reserves the card reconciliation to finance', () => {
    for (const role of ['owner', 'admin', 'accountant']) {
      expect(canAccessModule(EXPENSE_MANAGEMENT_FINANCE_MODULE, 'write', [role]), role).toBe(true);
    }
    expect(
      canAccessModule(EXPENSE_MANAGEMENT_FINANCE_MODULE, 'write', ['accountant_readonly']),
    ).toBe(false);
    expect(canAccessModule(EXPENSE_MANAGEMENT_FINANCE_MODULE, 'read', ['member'])).toBe(false);
    expect(
      canAccessModule(
        EXPENSE_MANAGEMENT_FINANCE_MODULE,
        'write',
        ['member'],
        ['expense_management.settle'],
      ),
    ).toBe(true);
  });
});
