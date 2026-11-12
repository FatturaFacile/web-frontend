import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TESTED_MENU_ROUTES } from '../../layout/sidebar/menu-availability';

/** The home page: it is where the blocked pages send the user, so it must always be reachable. */
const HOME_ROUTE = '/dashboard';

/**
 * Whether the url opens a page that the menu allows: the route of an enabled menu entry or one of its sub pages
 * (for example /sales/invoices and /sales/invoices/123). Query string and fragment are ignored.
 */
export function isUrlOfEnabledMenuRoute(url: string, enabledRoutes: readonly string[] = TESTED_MENU_ROUTES): boolean {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return [HOME_ROUTE, ...enabledRoutes].some((route) => path === route || path.startsWith(`${route}/`));
}

/**
 * A page whose menu entry is still disabled (not in TESTED_MENU_ROUTES) cannot be opened by typing its url:
 * the user is sent to the home page.
 */
export const menuEnabledGuard: CanActivateFn = (_route, state) =>
  isUrlOfEnabledMenuRoute(state.url) ? true : inject(Router).createUrlTree(['/']);
