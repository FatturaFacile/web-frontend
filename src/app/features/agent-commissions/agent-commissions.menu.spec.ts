import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import {
  AGENT_COMMISSIONS_MODULE,
  AGENT_COMMISSIONS_SETTLE_MODULE,
} from './agent-commissions.util';

const PAGES = [
  '/agent-commissions',
  '/agent-commissions/rules',
  '/agent-commissions/ledger',
  '/agent-commissions/enasarco',
  '/agent-commissions/statements',
  '/agent-commissions/exports',
  '/agent-commissions/settings',
];

describe('agent commissions navigation', () => {
  const group = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.AGENT_COMMISSIONS',
  );

  it('has a menu group with the seven pages, each with a translated name', () => {
    expect(group?.module).toBe(AGENT_COMMISSIONS_MODULE);
    expect(group?.children?.map((child) => child.route)).toEqual(PAGES);
    expect(group?.children?.map((child) => child.key)).toEqual([
      'NAV.AGENT_COMMISSIONS_AGENTS',
      'NAV.AGENT_COMMISSIONS_RULES',
      'NAV.AGENT_COMMISSIONS_LEDGER',
      'NAV.AGENT_COMMISSIONS_ENASARCO',
      'NAV.AGENT_COMMISSIONS_STATEMENTS',
      'NAV.AGENT_COMMISSIONS_EXPORTS',
      'NAV.AGENT_COMMISSIONS_SETTINGS',
    ]);
  });

  it('opens every page from the menu', () => {
    for (const page of PAGES) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
    }
  });

  it('guards the pages with the module of the commissions and the exports with the settle ability', () => {
    for (const page of PAGES.filter((route) => route !== '/agent-commissions/exports')) {
      expect(moduleOfUrl(page), page).toBe(AGENT_COMMISSIONS_MODULE);
    }
    expect(moduleOfUrl('/agent-commissions/exports')).toBe(AGENT_COMMISSIONS_SETTLE_MODULE);
  });

  it('puts the module behind its feature flag, as the other tracked modules', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['agent_commissions']).toEqual({
      issue: 338,
      routePrefix: '/agent-commissions',
    });
  });
});

describe('agent commissions access', () => {
  const read = (roles: string[], permissions: string[] = []) =>
    canAccessModule(AGENT_COMMISSIONS_MODULE, 'read', roles, permissions);
  const write = (roles: string[], permissions: string[] = []) =>
    canAccessModule(AGENT_COMMISSIONS_MODULE, 'write', roles, permissions);
  const settle = (roles: string[], permissions: string[] = []) =>
    canAccessModule(AGENT_COMMISSIONS_SETTLE_MODULE, 'write', roles, permissions);

  it('lets owner, admin, accountant, read-only accountant and sales manager read', () => {
    for (const role of ['owner', 'admin', 'accountant', 'accountant_readonly', 'sales_manager']) {
      expect(read([role]), role).toBe(true);
    }
    for (const role of ['sales', 'member', 'hr', 'warehouse', 'technician']) {
      expect(read([role]), role).toBe(false);
    }
  });

  it('lets owner, admin, accountant and sales manager maintain the conditions, never a read-only role', () => {
    for (const role of ['owner', 'admin', 'accountant', 'sales_manager']) {
      expect(write([role]), role).toBe(true);
    }
    expect(write(['accountant_readonly'])).toBe(false);
    expect(write(['sales'])).toBe(false);
  });

  it('reserves approval, payment, fiscal parameters and exports to owner, admin and accountant', () => {
    for (const role of ['owner', 'admin', 'accountant']) {
      expect(settle([role]), role).toBe(true);
    }
    for (const role of ['sales_manager', 'accountant_readonly', 'sales', 'member']) {
      expect(settle([role]), role).toBe(false);
    }
    expect(canAccessModule(AGENT_COMMISSIONS_SETTLE_MODULE, 'read', ['accountant_readonly'])).toBe(
      false,
    );
  });

  it('opens the abilities to a member granted the permissions on the membership', () => {
    expect(read(['member'], ['agent_commissions.read'])).toBe(true);
    expect(write(['member'], ['agent_commissions.read'])).toBe(false);
    expect(write(['member'], ['agent_commissions.write'])).toBe(true);
    expect(settle(['member'], ['agent_commissions.write'])).toBe(false);
    expect(settle(['member'], ['agent_commissions.settle'])).toBe(true);
    expect(settle(['member'], ['agent_commissions.*'])).toBe(true);
  });

  it('closes the module to a member with a deny permission, except the owner', () => {
    expect(read(['accountant'], ['deny:agent_commissions'])).toBe(false);
    expect(read(['owner'], ['deny:agent_commissions'])).toBe(true);
  });
});
