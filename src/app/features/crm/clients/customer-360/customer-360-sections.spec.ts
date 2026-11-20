import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it } from 'vitest';
import { icons } from '../../../../icons-provider';
import { Customer360AddressesComponent } from './customer-360-addresses.component';
import { Customer360ConsentsComponent } from './customer-360-consents.component';
import { Customer360HierarchyComponent, flattenHierarchy } from './customer-360-hierarchy.component';
import { Customer360InteractionsComponent } from './customer-360-interactions.component';
import { Customer360PersonsComponent } from './customer-360-persons.component';

const CONTACT = '/crm/contacts/c1';

describe('Customer 360 sections', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const url = (path: string) => http.expectOne((r) => r.url.endsWith(path));

  describe('addresses', () => {
    const address = (id: string, type: string, isDefault: boolean) => ({
      id,
      type,
      street: `Via ${id}`,
      postal_code: '6900',
      city: 'Lugano',
      country: 'CH',
      is_default: isDefault,
    });

    it('lists several addresses per type with the default first, and sets another default', () => {
      const fixture = TestBed.createComponent(Customer360AddressesComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.detectChanges();
      url(`${CONTACT}/addresses`).flush({
        data: [address('a1', 'shipping', false), address('a2', 'shipping', true), address('a3', 'billing', true)],
      });
      fixture.detectChanges();

      const groups = (fixture.componentInstance as unknown as { groups(): { type: string; items: { id: string }[] }[] }).groups();
      expect(groups.map((g) => g.type)).toEqual(['billing', 'shipping']);
      expect(groups[1].items.map((a) => a.id)).toEqual(['a2', 'a1']);

      (fixture.componentInstance as unknown as { makeDefault(a: unknown): void }).makeDefault(address('a1', 'shipping', false));
      const req = url(`${CONTACT}/addresses/a1/default`);
      expect(req.request.method).toBe('POST');
      req.flush({ data: address('a1', 'shipping', true) });
      url(`${CONTACT}/addresses`).flush({ data: [] });
    });

    it('makes the first address of a type its default and does not post an invalid form', () => {
      const fixture = TestBed.createComponent(Customer360AddressesComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.detectChanges();
      url(`${CONTACT}/addresses`).flush({ data: [address('a3', 'billing', true)] });
      const component = fixture.componentInstance as unknown as {
        add(): void;
        form: { patchValue(v: object): void };
      };

      component.add();
      http.expectNone((r) => r.method === 'POST');

      component.form.patchValue({ type: 'shipping', street: 'Via Nassa', postal_code: '6900', city: 'Lugano', country: 'ch' });
      component.add();
      const req = url(`${CONTACT}/addresses`);
      expect(req.request.body).toMatchObject({ type: 'shipping', is_default: true, country: 'CH' });
      req.flush({ data: address('a9', 'shipping', true) });
      url(`${CONTACT}/addresses`).flush({ data: [] });
    });
  });

  describe('contact persons', () => {
    it('groups the persons by role and promotes another one to primary', () => {
      const fixture = TestBed.createComponent(Customer360PersonsComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.detectChanges();
      url(`${CONTACT}/persons`).flush({
        data: [
          { id: 'p1', last_name: 'Rossi', role: 'purchasing', is_primary: true },
          { id: 'p2', last_name: 'Bianchi', role: 'technical', is_primary: false },
          { id: 'p3', last_name: 'Verdi', role: null, is_primary: false },
        ],
      });
      const component = fixture.componentInstance as unknown as {
        groups(): { role: string }[];
        makePrimary(p: { id: string }): void;
      };
      expect(component.groups().map((g) => g.role)).toEqual(['purchasing', 'technical', 'other']);

      component.makePrimary({ id: 'p2' });
      const req = url(`${CONTACT}/persons/p2`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ is_primary: true });
      req.flush({ data: {} });
      url(`${CONTACT}/persons`).flush({ data: [] });
    });

    it('marks the first person as primary and requires the last name', () => {
      const fixture = TestBed.createComponent(Customer360PersonsComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.detectChanges();
      url(`${CONTACT}/persons`).flush({ data: [] });
      const component = fixture.componentInstance as unknown as {
        add(): void;
        form: { patchValue(v: object): void };
      };

      component.add();
      http.expectNone((r) => r.method === 'POST');

      component.form.patchValue({ last_name: 'Rossi', role: 'sales' });
      component.add();
      const req = url(`${CONTACT}/persons`);
      expect(req.request.body).toMatchObject({ last_name: 'Rossi', role: 'sales', is_primary: true });
      req.flush({ data: {} });
      url(`${CONTACT}/persons`).flush({ data: [] });
    });
  });

  describe('hierarchy', () => {
    const tree = {
      id: 'c1',
      name: 'ACME',
      hierarchy_type: 'holding',
      country: 'CH',
      vat_number: null,
      uid_number: null,
      children: [{ id: 'c2', name: 'ACME IT', hierarchy_type: 'subsidiary', country: 'IT', vat_number: null, uid_number: null, children: [] }],
    };

    it('flattens the tree with its depth', () => {
      expect(flattenHierarchy(tree as never).map((r) => [r.node.id, r.depth])).toEqual([
        ['c1', 0],
        ['c2', 1],
      ]);
    });

    it('shows the chain and saves the parent with its hierarchy type', () => {
      const fixture = TestBed.createComponent(Customer360HierarchyComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.detectChanges();
      url(`${CONTACT}/hierarchy`).flush({ data: { ancestors: [{ id: 'h', name: 'Holding AG' }], tree } });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Holding AG');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('ACME IT');

      const component = fixture.componentInstance as unknown as { parent: string | null; type: string | null; save(): void };
      component.parent = 'h';
      component.type = 'subsidiary';
      component.save();
      const req = url(CONTACT);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ parent_id: 'h', hierarchy_type: 'subsidiary' });
      req.flush({ data: {} });
      url(`${CONTACT}/hierarchy`).flush({ data: { ancestors: [], tree } });
    });

    it('clears the hierarchy type when the parent is removed', () => {
      const fixture = TestBed.createComponent(Customer360HierarchyComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.componentRef.setInput('parentId', 'h');
      fixture.componentRef.setInput('hierarchyType', 'branch');
      fixture.detectChanges();
      url(`${CONTACT}/hierarchy`).flush({ data: { ancestors: [], tree } });
      const component = fixture.componentInstance as unknown as { parent: string | null; save(): void };
      expect(component.parent).toBe('h');

      component.parent = null;
      component.save();
      expect(url(CONTACT).request.body).toEqual({ parent_id: null, hierarchy_type: null });
    });
  });

  describe('consents', () => {
    it('shows the effective consents and records a withdrawal as a new entry', () => {
      const fixture = TestBed.createComponent(Customer360ConsentsComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.componentRef.setInput('regime', 'nlpd');
      fixture.detectChanges();
      const read = http.expectOne((r) => r.url.endsWith('/crm/consents') && r.method === 'GET');
      expect(read.request.params.get('contact_id')).toBe('c1');
      read.flush({
        effective: [{ channel: 'email', purpose: 'marketing', status: 'granted', captured_at: null, source: 'web_form' }],
        history: [],
      });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('NLPD');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('CRM.CUSTOMER360.CONSENT_PURPOSE_MARKETING');

      (fixture.componentInstance as unknown as { record(s: string): void }).record('withdrawn');
      const post = http.expectOne((r) => r.url.endsWith('/crm/consents') && r.method === 'POST');
      expect(post.request.body).toEqual({
        contact_id: 'c1',
        channel: 'email',
        purpose: 'marketing',
        source: 'phone',
        status: 'withdrawn',
      });
      post.flush({});
      http.expectOne((r) => r.url.endsWith('/crm/consents') && r.method === 'GET').flush({ effective: [], history: [] });
    });
  });

  describe('interactions', () => {
    it('logs an interaction, reloads the history and pages through it', () => {
      const fixture = TestBed.createComponent(Customer360InteractionsComponent);
      fixture.componentRef.setInput('contactId', 'c1');
      fixture.detectChanges();
      url(`${CONTACT}/interactions`).flush({
        data: [{ id: 'i1', type: 'call', subject: 'Offer call' }],
        meta: { current_page: 1, last_page: 2, total: 2 },
      });
      const component = fixture.componentInstance as unknown as {
        log(): void;
        loadMore(): void;
        hasMore(): boolean;
        interactions(): unknown[];
        form: { patchValue(v: object): void };
      };
      expect(component.hasMore()).toBe(true);

      component.loadMore();
      const page2 = url(`${CONTACT}/interactions`);
      expect(page2.request.params.get('page')).toBe('2');
      page2.flush({ data: [{ id: 'i2', type: 'note', subject: 'Note' }], meta: { current_page: 2, last_page: 2, total: 2 } });
      expect(component.interactions()).toHaveLength(2);
      expect(component.hasMore()).toBe(false);

      component.log();
      http.expectNone((r) => r.method === 'POST');
      component.form.patchValue({ type: 'meeting', subject: 'Kick-off', notes: 'On site' });
      component.log();
      const post = http.expectOne((r) => r.method === 'POST');
      expect(post.request.body).toEqual({ type: 'meeting', subject: 'Kick-off', notes: 'On site' });
      post.flush({ data: { id: 'i3' } });
      url(`${CONTACT}/interactions`).flush({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } });
    });
  });
});
