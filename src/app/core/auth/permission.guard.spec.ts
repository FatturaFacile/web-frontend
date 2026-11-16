import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
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
  const profile = (permissions?: string[]): UserProfile => ({
    id: 'u1',
    name: 'Test',
    email: 't@test.it',
    avatar: '',
    role: 'viewer',
    roles: [],
    permissions,
  });

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

  it('allows immediately when the permissions are already hydrated and granted', () => {
    store.setUser(profile(['delivery_notes.view']));

    expect(run(permissionGuard('delivery_notes.view'))).toBe(true);
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('redirects to the dashboard when hydrated but the permission is missing', () => {
    store.setUser(profile(['delivery_notes.view']));

    const result = run(permissionGuard('delivery_notes.cancel')) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/dashboard');
  });

  it('supports any-of semantics with an array of permissions', () => {
    store.setUser(profile(['delivery_notes.pdf']));

    expect(run(permissionGuard(['delivery_notes.invoice', 'delivery_notes.pdf']))).toBe(true);
  });

  it('cold refresh: waits for the profile before deciding (no decision on an empty permission list)', async () => {
    const pending = new Subject<{ data: UserProfile }>();
    authApi.me.mockReturnValue(pending);

    const result$ = run(permissionGuard('delivery_notes.view')) as Observable<boolean | UrlTree>;
    let decision: boolean | UrlTree | undefined;
    result$.subscribe((d) => (decision = d));

    // not authenticated and not hydrated yet: the guard has not decided
    expect(decision).toBeUndefined();
    expect(authApi.me).toHaveBeenCalledOnce();

    pending.next({ data: profile(['delivery_notes.view']) });
    expect(decision).toBe(true);
    expect(store.can('delivery_notes.view')).toBe(true);
  });

  it('cold refresh: denies a hydrated user without the permission', async () => {
    authApi.me.mockReturnValue(of({ data: profile(['delivery_notes.view']) }));

    const result$ = run(permissionGuard('delivery_notes.issue')) as Observable<boolean | UrlTree>;
    let decision: boolean | UrlTree | undefined;
    result$.subscribe((d) => (decision = d));

    expect(router.serializeUrl(decision as UrlTree)).toBe('/dashboard');
  });

  it('hydrates when the user is authenticated with a mock profile that carries no permissions', () => {
    store.login(); // default user: authenticated but permissions undefined
    authApi.me.mockReturnValue(of({ data: profile(['delivery_notes.view']) }));

    const result$ = run(permissionGuard('delivery_notes.view')) as Observable<boolean | UrlTree>;
    let decision: boolean | UrlTree | undefined;
    result$.subscribe((d) => (decision = d));

    expect(authApi.me).toHaveBeenCalledOnce();
    expect(decision).toBe(true);
  });

  it('sends unauthenticated users to /login with the return url', () => {
    authApi.me.mockReturnValue(throwError(() => new Error('401')));

    const result$ = run(permissionGuard('delivery_notes.view')) as Observable<boolean | UrlTree>;
    let decision: boolean | UrlTree | undefined;
    result$.subscribe((d) => (decision = d));

    expect(router.serializeUrl(decision as UrlTree)).toBe(
      '/login?returnUrl=%2Flogistics%2Fdelivery-notes',
    );
    expect(store.isAuthenticated()).toBe(false);
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
