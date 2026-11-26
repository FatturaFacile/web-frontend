import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../api/auth-api.service';
import { PermissionsService } from './permissions.service';
import { AccessMode } from './permissions';
import { loadFullProfileIfNeeded } from './profile-loader';

/** Page that blocks the app until the second factor the tenant requires is enrolled. */
export const TWO_FACTOR_SETUP_PATH = '/two-factor-setup';

/**
 * Requires an authenticated session; otherwise redirects to `/login?returnUrl=<current url>`.
 * In cookie-based Laravel Sanctum authentication:
 * 1. Checks if the user is already authenticated in the client store.
 * 2. If not, queries `GET /auth/profile` with browser session cookies to verify if an active session exists.
 * 3. On success, populates the user in `AuthStore` and permits route activation.
 * 4. On failure, redirects to `/login` preserving the return URL.
 * While the tenant requires a second factor the user has not enrolled (`twoFactorSetupRequired`), every route except the
 * enrolment page redirects to it, so the app never loads half-protected.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const authApi = inject(AuthApiService);

  if (authStore.isAuthenticated()) {
    if (authStore.twoFactorSetupRequired() && !state.url.startsWith(TWO_FACTOR_SETUP_PATH)) {
      return router.createUrlTree([TWO_FACTOR_SETUP_PATH], { queryParams: { returnUrl: state.url } });
    }
    const profile = loadFullProfileIfNeeded();
    return profile ? profile.pipe(map(() => true)) : true;
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
    const profile = loadFullProfileIfNeeded();

    const decide = (): true | UrlTree => {
      const user = authStore.user();

      if (!user) {
        return router.createUrlTree(['/login']);
      }

      const userRoles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : authStore.activeRoles());
      const hasRole = userRoles.some((r) => allowedRoles.includes(r));
      return hasRole ? true : router.createUrlTree(['/dashboard']);
    };

    // The roles of the member are known only once the full profile is loaded (cold refresh).
    return profile ? profile.pipe(map(decide)) : decide();
  };
};

/**
 * Restricts route access based on whether the active tenant role grants module access.
 */
export const moduleGuard = (module: string, mode: AccessMode = 'read'): CanActivateFn => {
  return () => {
    const permissions = inject(PermissionsService);
    const router = inject(Router);
    const profile = loadFullProfileIfNeeded();
    const decide = (): true | UrlTree => (permissions.hasAccess(module, mode) ? true : router.createUrlTree(['/dashboard']));

    // The permissions of the member are known only once the full profile is loaded (cold refresh).
    return profile ? profile.pipe(map(decide)) : decide();
  };
};

/**
 * Restricts a route to platform administrators (the API refuses everybody else); the others go to the home page.
 */
export const platformAdminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const profile = loadFullProfileIfNeeded();
  const decide = (): true | UrlTree => (authStore.user()?.is_platform_admin ? true : router.createUrlTree(['/dashboard']));
  return profile ? profile.pipe(map(decide)) : decide();
};

/**
 * Restricts a route to users holding at least one of the given permissions (RBAC from `/auth/profile`).
 *
 * Race-free on cold refresh (F5) and direct URL navigation: the guard waits for the full profile whenever the store
 * holds only the login answer, so it never decides on an empty permission list. Use it after `authGuard`; members
 * without the permission go to `/dashboard`.
 */
export const permissionGuard = (required: string | readonly string[]): CanActivateFn => {
  const needed = typeof required === 'string' ? [required] : required;

  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);
    const profile = loadFullProfileIfNeeded();
    const decide = (): true | UrlTree => (authStore.canAny(needed) ? true : router.createUrlTree(['/dashboard']));

    return profile ? profile.pipe(map(decide)) : decide();
  };
};

