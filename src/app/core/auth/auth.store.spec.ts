import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthStore, DEFAULT_USER } from './auth.store';
import { I18nService } from '../i18n';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('AuthStore (Cookie-based session)', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        I18nService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should initialize as unauthenticated without tokens in storage', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(localStorage.getItem('ff_token')).toBeNull();
    expect(sessionStorage.getItem('ff_token')).toBeNull();
  });

  it('should transition to authenticated on login() without writing tokens to storage', () => {
    store.login();

    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual(DEFAULT_USER);
    expect(store.activeTenantId()).toBe('t-it-01');

    // Asserts that no bearer token is written to web storage
    expect(localStorage.getItem('ff_token')).toBeNull();
    expect(sessionStorage.getItem('ff_token')).toBeNull();
  });

  it('should transition to unauthenticated on logout()', () => {
    store.login();
    expect(store.isAuthenticated()).toBe(true);

    store.logout();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('should switch tenants cleanly', () => {
    store.login();
    store.switchTenant('t-ch-02');

    expect(store.activeTenantId()).toBe('t-ch-02');
    expect(store.activeJurisdiction()).toBe('CH');
    expect(store.activeCurrency()).toBe('CHF');
  });

  it('should update user state with setUser()', () => {
    const customUser = {
      id: 'usr-999',
      name: 'Custom Admin',
      email: 'custom@admin.com',
      avatar: '',
      role: 'Superadmin',
      roles: ['SUPERADMIN'],
    };

    store.setUser(customUser);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual(customUser);

    store.setUser(null);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });
});
