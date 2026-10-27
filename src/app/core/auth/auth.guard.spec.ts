import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, provideRouter, UrlTree } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { authGuard, guestGuard } from './auth.guard';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../api/auth-api.service';
import { I18nService } from '../i18n';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('Auth Guards (Cookie-based Sanctum)', () => {
  let authStore: InstanceType<typeof AuthStore>;
  let authApiMock: { me: ReturnType<typeof vi.fn> };

  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    authApiMock = {
      me: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthStore,
        I18nService,
        { provide: AuthApiService, useValue: authApiMock },
      ],
    });

    authStore = TestBed.inject(AuthStore);
  });

  describe('authGuard', () => {
    it('should allow activation immediately when already authenticated in store', () => {
      authStore.login();

      const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
      expect(result).toBe(true);
      expect(authApiMock.me).not.toHaveBeenCalled();
    });

    it('should verify session via authApi.me() and allow when valid', async () => {
      authApiMock.me.mockReturnValue(
        of({
          data: {
            id: 'usr-001',
            name: 'Marco Rossi',
            email: 'm.rossi@rossiimpianti.it',
            avatar: '',
            role: 'Admin',
            roles: ['ADMIN'],
          },
        })
      );

      const obs$ = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState)) as import('rxjs').Observable<boolean>;
      let outcome: boolean | UrlTree | undefined;
      obs$.subscribe((res) => {
        outcome = res;
      });

      expect(authApiMock.me).toHaveBeenCalledTimes(1);
      expect(outcome).toBe(true);
      expect(authStore.isAuthenticated()).toBe(true);
    });

    it('should redirect to /login with returnUrl when session check fails', () => {
      authApiMock.me.mockReturnValue(throwError(() => new Error('401 Unauthorized')));

      const obs$ = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState)) as import('rxjs').Observable<UrlTree>;
      let outcome: UrlTree | undefined;
      obs$.subscribe((res) => {
        outcome = res;
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

    it('should redirect authenticated users to /sales/invoices', () => {
      authStore.login();

      const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/sales/invoices');
    });
  });
});
