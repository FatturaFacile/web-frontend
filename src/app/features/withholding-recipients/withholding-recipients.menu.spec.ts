import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import {
  WITHHOLDING_RECIPIENTS_MODULE,
  WITHHOLDING_RECIPIENTS_SETTLE_MODULE,
} from './withholding-recipients.util';

const PAGES = [
  '/withholding-recipients',
  '/withholding-recipients/simulator',
  '/withholding-recipients/settlements',
];

describe('withholding recipients navigation', () => {
  const group = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.WITHHOLDING_RECIPIENTS',
  );

  it('has a menu group with the three pages, each with a translated name', () => {
    expect(group?.module).toBe(WITHHOLDING_RECIPIENTS_MODULE);
    expect(group?.children?.map((child) => child.route)).toEqual(PAGES);
    expect(group?.children?.map((child) => child.key)).toEqual([
      'NAV.WITHHOLDING_RECIPIENTS_DASHBOARD',
      'NAV.WITHHOLDING_RECIPIENTS_SIMULATOR',
      'NAV.WITHHOLDING_RECIPIENTS_SETTLEMENTS',
    ]);
  });

  it('opens every page from the menu and guards them with the module', () => {
    for (const page of PAGES) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
      expect(moduleOfUrl(page), page).toBe(WITHHOLDING_RECIPIENTS_MODULE);
    }
  });

  it('puts the module behind its feature flag, as the other tracked modules', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['withholding_recipients']).toEqual({
      issue: 602,
      routePrefix: '/withholding-recipients',
    });
  });
});

describe('withholding recipients access', () => {
  const read = (roles: string[], permissions: string[] = []) =>
    canAccessModule(WITHHOLDING_RECIPIENTS_MODULE, 'read', roles, permissions);
  const write = (roles: string[], permissions: string[] = []) =>
    canAccessModule(WITHHOLDING_RECIPIENTS_MODULE, 'write', roles, permissions);
  const settle = (roles: string[], permissions: string[] = []) =>
    canAccessModule(WITHHOLDING_RECIPIENTS_SETTLE_MODULE, 'write', roles, permissions);

  it('lets finance, the read-only accountant and HR read', () => {
    for (const role of [
      'owner',
      'admin',
      'accountant',
      'accountant_readonly',
      'hr_manager',
      'hr',
    ]) {
      expect(read([role]), role).toBe(true);
    }
    for (const role of ['sales', 'member', 'warehouse', 'technician']) {
      expect(read([role]), role).toBe(false);
    }
  });

  it('lets finance and HR maintain the registry, never a read-only role', () => {
    for (const role of ['owner', 'admin', 'accountant', 'hr_manager', 'hr']) {
      expect(write([role]), role).toBe(true);
    }
    expect(write(['accountant_readonly'])).toBe(false);
  });

  it('reserves posting, F24, UniEmens and the annual CU to owner, admin and accountant', () => {
    for (const role of ['owner', 'admin', 'accountant']) {
      expect(settle([role]), role).toBe(true);
    }
    for (const role of ['hr', 'hr_manager', 'accountant_readonly', 'member']) {
      expect(settle([role]), role).toBe(false);
    }
  });

  it('opens the abilities to a member granted the permissions on the membership', () => {
    expect(read(['member'], ['withholding_recipients.read'])).toBe(true);
    expect(write(['member'], ['withholding_recipients.read'])).toBe(false);
    expect(write(['member'], ['withholding_recipients.write'])).toBe(true);
    expect(settle(['member'], ['withholding_recipients.write'])).toBe(false);
    expect(settle(['member'], ['withholding_recipients.settle'])).toBe(true);
    expect(settle(['member'], ['withholding_recipients.*'])).toBe(true);
  });
});
