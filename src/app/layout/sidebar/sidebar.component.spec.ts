import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PermissionsService } from '@core/auth/permissions.service';
import { isMenuRouteTested, normalizeMenuSearch } from './menu-availability';
import { SidebarComponent } from './sidebar.component';

function createSidebar() {
  TestBed.configureTestingModule({
    imports: [SidebarComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PermissionsService, useValue: { canRead: () => true } },
    ],
  });
  const fixture = TestBed.createComponent(SidebarComponent);
  fixture.detectChanges();
  return fixture;
}

describe('menu availability', () => {
  it('enables only the routes that are listed', () => {
    expect(isMenuRouteTested('/crm/clients', [])).toBe(false);
    expect(isMenuRouteTested(undefined, ['/crm/clients'])).toBe(false);
    expect(isMenuRouteTested('/crm/clients', ['/crm/clients'])).toBe(true);
    expect(isMenuRouteTested('/crm/suppliers', ['/crm/clients'])).toBe(false);
  });

  it('searches without caring about case and accents', () => {
    expect(normalizeMenuSearch('  Contabilità ')).toBe('contabilita');
    expect(normalizeMenuSearch('Übersicht')).toBe('ubersicht');
  });
});

describe('SidebarComponent menu', () => {
  it('lists every page once: no route is repeated and no group repeats a label', () => {
    const { componentInstance } = createSidebar();
    const routes: string[] = [];
    const repeatedLabels: string[] = [];

    for (const section of componentInstance.allMenuSections) {
      for (const item of section.items) {
        if (item.route) {
          routes.push(item.route);
        }
        const labels = new Set<string>();
        for (const child of item.children ?? []) {
          routes.push(child.route);
          if (labels.has(child.key)) {
            repeatedLabels.push(`${item.key}: ${child.key}`);
          }
          labels.add(child.key);
        }
      }
    }

    const repeatedRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);
    expect(repeatedRoutes).toEqual([]);
    expect(repeatedLabels).toEqual([]);
  });

  it('greys out every entry until its route is in the tested list', () => {
    const fixture = createSidebar();
    const menu = fixture.nativeElement as HTMLElement;

    expect(menu.querySelectorAll('li.ant-menu-item').length).toBeGreaterThan(0);
    // Only the entries whose route is in TESTED_MENU_ROUTES (the list changes as pages get tested) are links
    const links = Array.from(menu.querySelectorAll('a[href]'));
    for (const link of links) {
      expect(isMenuRouteTested(link.getAttribute('href') ?? undefined)).toBe(true);
    }
    expect(menu.querySelectorAll('li.ant-menu-item:not(.ant-menu-item-disabled)').length).toBeLessThanOrEqual(links.length);
  });

  it('filters the entries with the quick search and keeps the matching group', () => {
    const fixture = createSidebar();
    const sidebar = fixture.componentInstance as unknown as {
      searchTerm: { set(value: string): void };
      filteredSections(): { items: { key: string; children?: { key: string }[] }[] }[];
    };

    sidebar.searchTerm.set('NAV.CLIENTS');
    const found = sidebar.filteredSections().flatMap((section) => section.items);

    expect(found.map((item) => item.key)).toEqual(['NAV.CRM']);
    expect(found[0].children?.map((child) => child.key)).toEqual(['NAV.CLIENTS']);

    sidebar.searchTerm.set('nothing-has-this-label');
    expect(sidebar.filteredSections()).toEqual([]);

    sidebar.searchTerm.set('');
    expect(sidebar.filteredSections().length).toBeGreaterThan(5);
  });

  it('shows a message when the search finds nothing and clears it with the button', () => {
    const fixture = createSidebar();
    const sidebar = fixture.componentInstance as unknown as { searchTerm: { set(value: string): void } };
    const element = fixture.nativeElement as HTMLElement;

    sidebar.searchTerm.set('nothing-has-this-label');
    fixture.detectChanges();
    expect(element.querySelector('.menu-search-empty')).not.toBeNull();

    (element.querySelector('.sidebar-search-clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.menu-search-empty')).toBeNull();
  });
});
