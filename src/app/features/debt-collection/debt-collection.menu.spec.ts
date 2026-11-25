import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { PREMATURE_OPEN_ISSUE_MODULES } from '../../core/auth/feature-flag.guard';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { DEBT_COLLECTION_MODULE } from './debt-collection.util';

describe('debt collection navigation', () => {
  const entry = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'debtCollection.nav.title',
  );

  it('has a menu entry for the workbench, translated from the debtCollection namespace', () => {
    expect(entry?.route).toBe('/debt-collection');
    expect(entry?.module).toBe(DEBT_COLLECTION_MODULE);
  });

  it('opens the page from the menu and guards it with the module', () => {
    expect(isUrlOfEnabledMenuRoute('/debt-collection')).toBe(true);
    expect(moduleOfUrl('/debt-collection')).toBe(DEBT_COLLECTION_MODULE);
  });

  it('puts the module behind its feature flag, as the other tracked modules', () => {
    expect(PREMATURE_OPEN_ISSUE_MODULES['debt_collection']).toEqual({
      issue: 267,
      routePrefix: '/debt-collection',
    });
  });
});

describe('debt collection access', () => {
  const read = (roles: string[], permissions: string[] = []) =>
    canAccessModule(DEBT_COLLECTION_MODULE, 'read', roles, permissions);
  const write = (roles: string[], permissions: string[] = []) =>
    canAccessModule(DEBT_COLLECTION_MODULE, 'write', roles, permissions);

  it('lets finance and sales managers read, nobody else', () => {
    for (const role of ['owner', 'admin', 'accountant', 'accountant_readonly', 'sales_manager']) {
      expect(read([role]), role).toBe(true);
    }
    for (const role of ['sales', 'member', 'hr', 'warehouse', 'technician']) {
      expect(read([role]), role).toBe(false);
    }
  });

  it('lets owner, admin and accountant send and escalate, never a read-only role', () => {
    for (const role of ['owner', 'admin', 'accountant']) {
      expect(write([role]), role).toBe(true);
    }
    expect(write(['accountant_readonly'])).toBe(false);
    expect(write(['sales_manager'])).toBe(false);
    expect(write(['sales'])).toBe(false);
  });

  it('honours the permission grants of the API', () => {
    expect(read(['member'], ['debt_collection.read'])).toBe(true);
    expect(write(['member'], ['debt_collection.read'])).toBe(false);
    expect(write(['member'], ['debt_collection.write'])).toBe(true);
    expect(write(['accountant'], ['deny:debt_collection.write'])).toBe(false);
  });
});
