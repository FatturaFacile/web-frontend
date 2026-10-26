import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { clearAuthToken, readValidAuthToken } from './token-storage';

/** Requires a valid token; otherwise bounces to `/login?returnUrl=<current url>`. */
export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated() && readValidAuthToken()) {
    return true;
  }

  clearAuthToken();
  authStore.logout();
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Keeps authenticated users away from `/login`. */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return authStore.isAuthenticated() && readValidAuthToken()
    ? router.createUrlTree(['/sales/invoices'])
    : true;
};