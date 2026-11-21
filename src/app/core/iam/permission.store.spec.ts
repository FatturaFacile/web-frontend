import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from '../auth/auth.store';
import type { PermissionSnapshot } from './iam.models';
import { PermissionStore } from './permission.store';

const url = `${environment.apiBaseUrl}/profile/permissions`;

const snapshot = (permissions: string[], field_policies: PermissionSnapshot['field_policies'] = []): { data: PermissionSnapshot } => ({
  data: { permissions, field_policies, company_id: null },
});

describe('PermissionStore', () => {
  let store: PermissionStore;
  let http: HttpTestingController;
  const authenticated = signal(false);
  const tenantId = signal('t1');

  beforeEach(() => {
    authenticated.set(false);
    tenantId.set('t1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { isAuthenticated: authenticated, activeTenantId: tenantId } },
      ],
    });
    store = TestBed.inject(PermissionStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('denies everything until the snapshot is loaded', () => {
    expect(store.loaded()).toBe(false);
    expect(store.hasPermission('crm.contacts.view')).toBe(false);
    expect(store.isFieldMasked('hr.employee', 'base_annual_salary')).toBe(false);
  });

  it('grants exact keys, module wildcards and the global wildcard', async () => {
    const loading = store.load();
    http.expectOne(url).flush(snapshot(['crm.contacts.view', 'ledger.*']));
    await loading;

    expect(store.hasPermission('crm.contacts.view')).toBe(true);
    expect(store.hasPermission('crm.contacts.delete')).toBe(false);
    expect(store.hasPermission('ledger.journals.post')).toBe(true);
    expect(store.hasAnyPermission(['hr.payroll.view', 'crm.contacts.view'])).toBe(true);

    const reloading = store.reload();
    http.expectOne(url).flush(snapshot(['*']));
    await reloading;
    expect(store.hasPermission('anything.at.all')).toBe(true);
  });

  it('shares one request between concurrent loads and keeps the result', async () => {
    const first = store.load();
    const second = store.load();
    http.expectOne(url).flush(snapshot(['crm.contacts.view']));
    await Promise.all([first, second]);

    await store.load();
    http.expectNone(url);
    expect(store.loaded()).toBe(true);
  });

  it('applies the most restrictive field visibility', async () => {
    const loading = store.load();
    http.expectOne(url).flush(
      snapshot(
        [],
        [
          { resource: 'hr.employee', field: 'base_annual_salary', visibility: 'masked', kind: 'amount' },
          { resource: 'hr.employee', field: 'base_annual_salary', visibility: 'hidden', kind: 'amount' },
          { resource: 'hr.employee', field: 'iban', visibility: 'masked', kind: 'iban' },
        ],
      ),
    );
    await loading;

    expect(store.fieldVisibility('hr.employee', 'base_annual_salary')).toBe('hidden');
    expect(store.isFieldHidden('hr.employee', 'base_annual_salary')).toBe(true);
    expect(store.isFieldMasked('hr.employee', 'iban')).toBe(true);
    expect(store.fieldVisibility('hr.employee', 'work_email')).toBe('visible');
  });

  it('drops the snapshot when invalidated and denies again', async () => {
    const loading = store.load();
    http.expectOne(url).flush(snapshot(['crm.contacts.view']));
    await loading;

    store.invalidate();
    expect(store.hasPermission('crm.contacts.view')).toBe(false);
  });

  it('stays denied when the snapshot cannot be loaded', async () => {
    const loading = store.load();
    http.expectOne(url).flush({}, { status: 500, statusText: 'Server Error' });
    await loading;

    expect(store.loaded()).toBe(false);
  });

  it('loads the new session and drops it on logout or company switch', async () => {
    authenticated.set(true);
    TestBed.tick();
    http.expectOne(url).flush(snapshot(['crm.contacts.view']));
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.hasPermission('crm.contacts.view')).toBe(true);

    tenantId.set('t2');
    TestBed.tick();
    http.expectOne(url).flush(snapshot(['hr.payroll.view']));
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.hasPermission('crm.contacts.view')).toBe(false);
    expect(store.hasPermission('hr.payroll.view')).toBe(true);
  });
});
