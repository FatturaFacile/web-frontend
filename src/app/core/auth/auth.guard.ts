import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../api/auth-api.service';

/**
 * Requires an authenticated session; otherwise redirects to `/login?returnUrl=<current url>`.
 * In cookie-based Laravel Sanctum authentication:
 * 1. Checks if the user is already authenticated in the client store.
 * 2. If not, queries `GET /auth/profile` with browser session cookies to verify if an active session exists.
 * 3. On success, populates the user in `AuthStore` and permits route activation.
 * 4. On failure, redirects to `/login` preserving the return URL.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const authApi = inject(AuthApiService);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return authApi.me().pipe(
    map((res) => {
      authStore.login(undefined, res.data);
      return true;
    }),
    catchError(() => {
      authStore.logout();
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    })
  );
};

/**
 * Keeps authenticated users away from `/login`.
 */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return authStore.isAuthenticated()
    ? router.createUrlTree(['/sales/invoices'])
    : true;
};

/**
 * Restricts route access based on user RBAC roles.
 */
export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);
    const user = authStore.user();

    if (!user) {
      return router.createUrlTree(['/login']);
    }

    const userRoles = user.roles || (user.role ? [user.role] : []);
    const hasRole = userRoles.some((r) => allowedRoles.includes(r));
    return hasRole ? true : router.createUrlTree(['/dashboard']);
  };
};

/**
 * Restricts a route to users holding at least one of the given permissions (RBAC from `/auth/profile`).
 *
 * Race-free on cold refresh (F5) and direct URL navigation: the permissions are awaited from the API whenever the
 * session was not hydrated with them yet, so the guard never decides on an empty permission list and the
 * unauthorized page never flashes. Unauthenticated users go to `/login?returnUrl=...`, authenticated users without
 * the permission go to `/dashboard`.
 */
export const permissionGuard = (required: string | readonly string[]): CanActivateFn => {
  const needed = typeof required === 'string' ? [required] : required;

  return (_route, state) => {
    const authStore = inject(AuthStore);
    const router = inject(Router);
    const authApi = inject(AuthApiService);

    const decide = () =>
      authStore.canAny(needed) ? true : router.createUrlTree(['/dashboard']);

    if (authStore.isAuthenticated() && authStore.permissionsLoaded()) {
      return decide();
    }

    return authApi.me().pipe(
      map((res) => {
        authStore.setUser(res.data);
        return decide();
      }),
      catchError(() => {
        authStore.logout();
        return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
      })
    );
  };
};
