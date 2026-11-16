import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore, UserProfile } from '@core';
import { SidebarComponent } from './sidebar.component';

describe('Sidebar RBAC filtering', () => {
  const user = (permissions: string[]): UserProfile => ({
    id: '1',
    name: 'A',
    email: 'a@a.it',
    avatar: '',
    role: 'x',
    roles: [],
    permissions,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  const logisticsChildren = (component: SidebarComponent): string[] => {
    const sections = component.filteredSections();
    const group = sections.flatMap((s) => s.items).find((i) => i.key === 'NAV.LOGISTICS');
    return group?.children?.map((c) => c.route) ?? [];
  };

  it('hides the whole logistics group without any logistics permission', () => {
    TestBed.inject(AuthStore).setUser(user([]));
    const component = TestBed.createComponent(SidebarComponent).componentInstance;

    expect(logisticsChildren(component)).toEqual([]);
  });

  it('shows only the entries the role may open', () => {
    TestBed.inject(AuthStore).setUser(user(['delivery_notes.view']));
    const component = TestBed.createComponent(SidebarComponent).componentInstance;

    expect(logisticsChildren(component)).toEqual([
      '/logistics/delivery-notes',
      '/logistics/consignment',
    ]);
  });

  it('shows transfers to roles that manage them and reacts to permission changes', () => {
    const store = TestBed.inject(AuthStore);
    store.setUser(user(['delivery_notes.view', 'logistics.transfers.manage']));
    const component = TestBed.createComponent(SidebarComponent).componentInstance;
    expect(logisticsChildren(component)).toContain('/logistics/transfers');

    store.setUser(user(['delivery_notes.view']));
    expect(logisticsChildren(component)).not.toContain('/logistics/transfers');
  });
});
