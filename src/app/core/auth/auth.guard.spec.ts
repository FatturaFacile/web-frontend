import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authGuard, guestGuard, roleGuard, moduleGuard } from '@core/auth/auth.guard';
import { AuthStore } from '@core/auth/auth.store';
import { AuthApiService } from '@core/api/auth-api.service';
import { I18nService } from '@core/i18n';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('Auth Guards (Cookie-Based Laravel Sanctum)', () => {
  let authStore: InstanceType<typeof AuthStore>;
  let authApiMock: { me: ReturnType<typeof vi.fn> };
  let dummyRoute: ActivatedRouteSnapshot;
  let dummyState: RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    authApiMock = {
      me: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        I18nService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: authApiMock },
      ],
    });

    authStore = TestBed.inject(AuthStore);
    dummyRoute = {} as ActivatedRouteSnapshot;
    dummyState = { url: '/dashboard' } as RouterStateSnapshot;
  });

  describe('authGuard', () => {
    it('should allow immediately when already marked authenticated in store', () => {
      authStore.login();

      const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
      expect(result).toBe(true);
      expect(authApiMock.me).not.toHaveBeenCalled();
    });

    it('should verify session cookie via authApi.me() and allow when valid', () => {
      const mockProfile = {
        id: 'usr-001',
        name: 'Marco',
        email: 'm@example.com',
        avatar: '',
        role: 'Admin',
        roles: ['ADMIN'],
      };
      authApiMock.me.mockReturnValue(of({ success: true, data: mockProfile }));

      const obs$ = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState)) as import('rxjs').Observable<boolean>;
      let outcome = false;
      obs$.subscribe((val) => {
        outcome = val;
      });

      expect(authApiMock.me).toHaveBeenCalledTimes(1);
      expect(outcome).toBe(true);
      expect(authStore.isAuthenticated()).toBe(true);
      expect(authStore.user()?.id).toBe('usr-001');
    });

    it('should redirect to /login with returnUrl when session cookie check fails', () => {
      authApiMock.me.mockReturnValue(throwError(() => new Error('401 Unauthorized')));

      const obs$ = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState)) as import('rxjs').Observable<UrlTree>;
      let outcome: UrlTree | undefined;
      obs$.subscribe((val) => {
        outcome = val;
      });

      expect(authApiMock.me).toHaveBeenCalledTimes(1);
      expect(outcome).toBeInstanceOf(UrlTree);
      expect(outcome?.toString()).toBe('/login?returnUrl=%2Fdashboard');
      expect(authStore.isAuthenticated()).toBe(false);
    });
  });

  describe('guestGuard', () => {
    it('should allow unauthenticated visitors to navigate to login', () => {
      const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));
      expect(result).toBe(true);
    });

    it('should bounce authenticated users away to /sales/invoices', () => {
      authStore.login();

      const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/sales/invoices');
    });
  });

  describe('roleGuard', () => {
    it('should allow access when user possesses the required role', () => {
      authStore.login(undefined, {
        id: 'usr-001',
        name: 'Marco',
        email: 'm@example.com',
        avatar: '',
        role: 'ADMIN',
        roles: ['ADMIN'],
      });

      const guard = roleGuard(['ADMIN', 'SUPER_ADMIN']);
      const result = TestBed.runInInjectionContext(() => guard(dummyRoute, dummyState));
      expect(result).toBe(true);
    });

    it('should redirect to /dashboard when user lacks the required role', () => {
      authStore.login(undefined, {
        id: 'usr-002',
        name: 'Luigi',
        email: 'l@example.com',
        avatar: '',
        role: 'ACCOUNTANT',
        roles: ['ACCOUNTANT'],
      });

      const guard = roleGuard(['ADMIN']);
      const result = TestBed.runInInjectionContext(() => guard(dummyRoute, dummyState));
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/dashboard');
    });
  });

  describe('moduleGuard', () => {
    it('should allow access when user can access module', () => {
      authStore.login(undefined, {
        id: 'usr-001',
        name: 'Marco',
        email: 'm@example.com',
        role: 'owner',
        roles: ['owner'],
        permissions: ['*'],
      });

      const guard = moduleGuard('crm', 'write');
      const result = TestBed.runInInjectionContext(() => guard(dummyRoute, dummyState));
      expect(result).toBe(true);
    });

    it('should redirect to /dashboard when module access is forbidden', () => {
      authStore.login(undefined, {
        id: 'usr-002',
        name: 'Luigi',
        email: 'l@example.com',
        role: 'member',
        roles: ['member'],
        permissions: [],
      });

      const guard = moduleGuard('system', 'write');
      const result = TestBed.runInInjectionContext(() => guard(dummyRoute, dummyState));
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/dashboard');
    });
  });
});
