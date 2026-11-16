import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../api/auth-api.service';
import { I18nService } from '../i18n';
import { permissionGuard } from './auth.guard';
import { AuthStore, UserProfile } from './auth.store';

describe('permissionGuard (RBAC, cold refresh safe)', () => {
  let store: InstanceType<typeof AuthStore>;
  let router: Router;
  let authApi: { me: ReturnType<typeof vi.fn> };

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/logistics/delivery-notes' } as RouterStateSnapshot;
  /** A complete profile (carries the active tenant), as returned by `/auth/profile`. */
  const profile = (permissions: string[]): UserProfile => ({
    id: 'u1',
    name: 'Test',
    email: 't@test.it',
    avatar: '',
    role: 'viewer',
    roles: [],
    permissions,
    active_tenant: { id: 't-it-01', name: 'Tenant', role: 'viewer' },
  });
  /** What the login answer carries: no tenants, so the profile still has to be loaded. */
  const loginAnswer: UserProfile = {
    id: 'u1',
    name: 'Test',
    email: 't@test.it',
    avatar: '',
    role: 'viewer',
    roles: [],
  };

  const run = (guard: ReturnType<typeof permissionGuard>) =>
    TestBed.runInInjectionContext(() => guard(route, state)) as
      boolean | UrlTree | Observable<boolean | UrlTree>;

  beforeEach(() => {
    authApi = { me: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthStore,
        I18nService,
        { provide: AuthApiService, useValue: authApi },
      ],
    });
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  it('allows immediately when the profile is complete and the permission is granted', () => {
    store.login(undefined, profile(['delivery_notes.view']));

    expect(run(permissionGuard('delivery_notes.view'))).toBe(true);
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('redirects to the dashboard when the permission is missing', () => {
    store.login(undefined, profile(['delivery_notes.view']));

    const result = run(permissionGuard('delivery_notes.cancel')) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/dashboard');
  });

  it('supports any-of semantics with an array of permissions', () => {
    store.login(undefined, profile(['delivery_notes.pdf']));

    expect(run(permissionGuard(['delivery_notes.invoice', 'delivery_notes.pdf']))).toBe(true);
  });

  it('cold refresh: waits for the full profile before deciding (no decision on an empty permission list)', () => {
    const pending = new Subject<{ data: UserProfile }>();
    authApi.me.mockReturnValue(pending);
    store.login(undefined, loginAnswer);

    const result$ = run(permissionGuard('delivery_notes.view')) as Observable<boolean | UrlTree>;
    let decision: boolean | UrlTree | undefined;
    result$.subscribe((d) => (decision = d));

    expect(decision).toBeUndefined();
    expect(authApi.me).toHaveBeenCalledOnce();

    pending.next({ data: profile(['delivery_notes.view']) });
    expect(decision).toBe(true);
    expect(store.can('delivery_notes.view')).toBe(true);
  });

  it('cold refresh: denies a member whose loaded profile lacks the permission', () => {
    authApi.me.mockReturnValue(of({ data: profile(['delivery_notes.view']) }));
    store.login(undefined, loginAnswer);

    const result$ = run(permissionGuard('delivery_notes.issue')) as Observable<boolean | UrlTree>;
    let decision: boolean | UrlTree | undefined;
    result$.subscribe((d) => (decision = d));

    expect(router.serializeUrl(decision as UrlTree)).toBe('/dashboard');
  });
});

describe('AuthStore permissions', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthStore, I18nService],
    });
  });

  it('exposes can / canAny / permissionsLoaded from the profile', () => {
    const store = TestBed.inject(AuthStore);
    expect(store.permissionsLoaded()).toBe(false);
    expect(store.can('delivery_notes.view')).toBe(false);

    store.setUser({
      id: '1',
      name: 'A',
      email: 'a@a.it',
      avatar: '',
      role: 'accountant',
      roles: [],
      permissions: ['delivery_notes.invoice'],
    });

    expect(store.permissionsLoaded()).toBe(true);
    expect(store.can('delivery_notes.invoice')).toBe(true);
    expect(store.can('delivery_notes.cancel')).toBe(false);
    expect(store.canAny(['delivery_notes.cancel', 'delivery_notes.invoice'])).toBe(true);
    expect(store.permissions()).toEqual(['delivery_notes.invoice']);

    store.logout();
    expect(store.can('delivery_notes.invoice')).toBe(false);
  });
});
