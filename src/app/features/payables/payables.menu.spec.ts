import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { PAYABLES_APPROVAL_MODULE, PAYABLES_MODULE } from './payables.util';

const PAGES = ['/payables', '/payables/batches', '/payables/aging'];

describe('payables navigation', () => {
  const group = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.PAYABLES',
  );

  it('has a menu group with the three pages', () => {
    expect(group?.module).toBe(PAYABLES_MODULE);
    expect(group?.children?.map((child) => child.route)).toEqual(PAGES);
  });

  it('opens every page, the wizard and a batch from the menu', () => {
    for (const page of PAGES) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
    }
    expect(isUrlOfEnabledMenuRoute('/payables?supplier_id=s-1&open_only=1')).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/payables/batches/new')).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/payables/batches/b-1')).toBe(true);
  });

  it('guards the pages with the payables module', () => {
    for (const url of [...PAGES, '/payables/batches/new', '/payables/batches/b-1']) {
      expect(moduleOfUrl(url), url).toBe(PAYABLES_MODULE);
    }
  });

  it('lets finance prepare the batches and only owner and admin approve and execute', () => {
    expect(canAccessModule(PAYABLES_MODULE, 'read', ['accountant_readonly'])).toBe(true);
    expect(canAccessModule(PAYABLES_MODULE, 'write', ['accountant_readonly'])).toBe(false);
    expect(canAccessModule(PAYABLES_MODULE, 'write', ['accountant'])).toBe(true);
    expect(canAccessModule(PAYABLES_MODULE, 'read', ['warehouse'])).toBe(false);
    expect(canAccessModule(PAYABLES_APPROVAL_MODULE, 'write', ['accountant'])).toBe(false);
    expect(canAccessModule(PAYABLES_APPROVAL_MODULE, 'write', ['admin'])).toBe(true);
    expect(canAccessModule(PAYABLES_APPROVAL_MODULE, 'write', ['owner'])).toBe(true);
  });
});
