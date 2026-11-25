import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { TENDER_MANAGEMENT_MODULE } from './tender-management.util';

const PAGES = ['/tender-management', '/tender-management/vault', '/tender-management/benchmarks'];

describe('tender management navigation', () => {
  const group = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.TENDER_MANAGEMENT',
  );

  it('has a menu group with the three pages, each with a translated name', () => {
    expect(group?.module).toBe(TENDER_MANAGEMENT_MODULE);
    expect(group?.children?.map((child) => child.route)).toEqual(PAGES);
    expect(group?.children?.map((child) => child.key)).toEqual([
      'NAV.TENDER_MANAGEMENT_PIPELINE',
      'NAV.TENDER_MANAGEMENT_VAULT',
      'NAV.TENDER_MANAGEMENT_BENCHMARKS',
    ]);
  });

  it('opens every page from the menu', () => {
    for (const page of PAGES) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
      expect(moduleOfUrl(page), page).toBe(TENDER_MANAGEMENT_MODULE);
    }
  });

  it('puts the module behind its feature flag, as the other tracked modules', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['tender_management']).toEqual({
      issue: 415,
      routePrefix: '/tender-management',
    });
  });
});

describe('tender management access', () => {
  it('opens the module to the finance roles', () => {
    for (const role of ['owner', 'admin', 'accountant']) {
      expect(canAccessModule(TENDER_MANAGEMENT_MODULE, 'read', [role]), role).toBe(true);
      expect(canAccessModule(TENDER_MANAGEMENT_MODULE, 'write', [role]), role).toBe(true);
    }
  });

  it('lets the read-only accountant read but not write', () => {
    expect(canAccessModule(TENDER_MANAGEMENT_MODULE, 'read', ['accountant_readonly'])).toBe(true);
    expect(canAccessModule(TENDER_MANAGEMENT_MODULE, 'write', ['accountant_readonly'])).toBe(false);
  });

  it('opens the module to a member granted the permission', () => {
    expect(canAccessModule(TENDER_MANAGEMENT_MODULE, 'write', ['member'])).toBe(false);
    expect(
      canAccessModule(TENDER_MANAGEMENT_MODULE, 'write', ['member'], ['tender_management.write']),
    ).toBe(true);
  });
});
