import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { MenuSection } from '../../layout/sidebar/menu-sections';
import { isUrlOfEnabledMenuRoute, menuEnabledGuard, moduleOfUrl } from './menu-enabled.guard';
import { PermissionsService } from './permissions.service';
import { canAccessModule } from './permissions';

beforeEach(() => TestBed.resetTestingModule());

describe('isUrlOfEnabledMenuRoute', () => {
  const enabled = ['/sales/invoices', '/crm/clients'];

  it('always allows the home page', () => {
    expect(isUrlOfEnabledMenuRoute('/dashboard', [])).toBe(true);
  });

  it('blocks every page when no menu entry is enabled', () => {
    expect(isUrlOfEnabledMenuRoute('/sales/invoices', [])).toBe(false);
  });

  it('allows an enabled route and its sub pages, ignoring query string and fragment', () => {
    expect(isUrlOfEnabledMenuRoute('/sales/invoices', enabled)).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/sales/invoices/123?tab=1#top', enabled)).toBe(true);
  });

  it('blocks the routes of disabled entries, also with a shared prefix', () => {
    expect(isUrlOfEnabledMenuRoute('/sales/quotes', enabled)).toBe(false);
    expect(isUrlOfEnabledMenuRoute('/sales/invoices-archive', enabled)).toBe(false);
    expect(isUrlOfEnabledMenuRoute('/crm/suppliers', enabled)).toBe(false);
  });
});

describe('moduleOfUrl', () => {
  const sections: MenuSection[] = [
    {
      items: [
        { key: 'a', icon: 'x', route: '/dashboard' },
        {
          key: 'b',
          icon: 'x',
          module: 'crm',
          children: [
            { key: 'b1', route: '/crm/clients', icon: 'x' },
            { key: 'b2', route: '/crm/billing', icon: 'x', module: 'invoicing' },
          ],
        },
      ],
    },
  ];

  it('has no module for a page without one', () => {
    expect(moduleOfUrl('/dashboard', sections)).toBeUndefined();
    expect(moduleOfUrl('/unknown/page', sections)).toBeUndefined();
  });

  it('takes the module of the group, or the one of the entry when it has its own', () => {
    expect(moduleOfUrl('/crm/clients', sections)).toBe('crm');
    expect(moduleOfUrl('/crm/billing', sections)).toBe('invoicing');
  });

  it('gives a sub page the module of its entry, ignoring query string and fragment', () => {
    expect(moduleOfUrl('/crm/clients/123?tab=1#top', sections)).toBe('crm');
    expect(moduleOfUrl('/crm/clients-archive', sections)).toBeUndefined();
  });
});

describe('menuEnabledGuard', () => {
  function run(url: string, roles: string[], permissions: string[] = []): unknown {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: PermissionsService,
          useValue: { canRead: (module: string) => canAccessModule(module, 'read', roles, permissions) },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => menuEnabledGuard({} as never, { url } as never));
  }

  it('lets a member open the pages of the modules they can read', () => {
    expect(run('/crm/clients', ['member'])).toBe(true);
  });

  it('sends a member without access to the module to the home page', () => {
    const result = run('/crm/clients', ['member'], ['deny:crm']);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('lets the owner in whatever the deny says', () => {
    expect(run('/crm/clients', ['owner'], ['deny:crm'])).toBe(true);
  });

  it('sends a member to the home page for a role-restricted module typed in the url', () => {
    expect(run('/hr/time', ['member'])).toBeInstanceOf(UrlTree);
    expect(run('/hr/time', ['hr'])).toBe(true);
  });
});
