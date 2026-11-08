import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionsService } from './permissions.service';
import { AuthStore, DEFAULT_USER } from './auth.store';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let authStore: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PermissionsService],
    });

    service = TestBed.inject(PermissionsService);
    authStore = TestBed.inject(AuthStore);
  });

  it('allows owner to write in crm and system', () => {
    authStore.login('t-it-01', {
      ...DEFAULT_USER,
      active_tenant: { id: 't-it-01', name: 'Test', country: 'IT', role: 'owner' },
    });

    expect(service.canRead('crm')).toBe(true);
    expect(service.canWrite('crm')).toBe(true);
    expect(service.canRead('system')).toBe(true);
    expect(service.canWrite('system')).toBe(true);
  });

  it('allows member to read crm but not write system or invoicing', () => {
    authStore.login('t-it-01', {
      ...DEFAULT_USER,
      role: 'member',
      roles: ['member'],
      permissions: [],
      active_tenant: { id: 't-it-01', name: 'Test', country: 'IT', role: 'member' },
    });

    expect(service.canRead('crm')).toBe(true);
    expect(service.canWrite('crm')).toBe(false);
    expect(service.canRead('system')).toBe(false);
    expect(service.canWrite('system')).toBe(false);
    expect(service.canRead('invoicing')).toBe(true);
    expect(service.canWrite('invoicing')).toBe(false);
  });

  it('prevents accountant_readonly from write access anywhere', () => {
    authStore.login('t-it-01', {
      ...DEFAULT_USER,
      role: 'accountant_readonly',
      roles: ['accountant_readonly'],
      permissions: ['*'],
      active_tenant: { id: 't-it-01', name: 'Test', country: 'IT', role: 'accountant_readonly' },
    });

    expect(service.isReadOnlyRole()).toBe(true);
    expect(service.canRead('treasury')).toBe(true);
    expect(service.canWrite('treasury')).toBe(false);
  });
});
