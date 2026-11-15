import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { MENU_SECTIONS, MenuSection } from '../../layout/sidebar/menu-sections';
import { TESTED_MENU_ROUTES } from '../../layout/sidebar/menu-availability';
import { PermissionsService } from './permissions.service';
import { loadFullProfileIfNeeded } from './profile-loader';

/** The home page: it is where the blocked pages send the user, so it must always be reachable. */
const HOME_ROUTE = '/dashboard';

/** Pages that are not in the menu (it hides the settings group) but still belong to a module. */
const PAGE_MODULES: readonly { route: string; module: string }[] = [
  { route: '/system', module: 'system' },
  { route: '/workspace', module: 'workspace' },
];

function pathOf(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

/**
 * Whether the url opens a page that the menu allows: the route of an enabled menu entry or one of its sub pages
 * (for example /sales/invoices and /sales/invoices/123). Query string and fragment are ignored.
 */
export function isUrlOfEnabledMenuRoute(url: string, enabledRoutes: readonly string[] = TESTED_MENU_ROUTES): boolean {
  const path = pathOf(url);
  return [HOME_ROUTE, ...enabledRoutes].some((route) => path === route || path.startsWith(`${route}/`));
}

/**
 * The ERP module that guards the page of the url, taken from the most specific menu entry the url belongs to
 * (a sub page belongs to its entry). `undefined` when the page has no module: every member may open it.
 */
export function moduleOfUrl(url: string, sections: readonly MenuSection[] = MENU_SECTIONS): string | undefined {
  const path = pathOf(url);
  let best: { route: string; module?: string } | undefined;

  for (const section of sections) {
    for (const item of section.items) {
      const entries = [
        ...(item.route ? [{ route: item.route, module: item.module }] : []),
        ...(item.children ?? []).map((child) => ({ route: child.route, module: child.module ?? item.module })),
      ];
      for (const entry of entries) {
        const matches = path === entry.route || path.startsWith(`${entry.route}/`);
        if (matches && (best === undefined || entry.route.length > best.route.length)) {
          best = entry;
        }
      }
    }
  }

  if (best === undefined) {
    return PAGE_MODULES.find(({ route }) => path === route || path.startsWith(`${route}/`))?.module;
  }

  return best.module;
}

/**
 * A page whose menu entry is still disabled (not in TESTED_MENU_ROUTES) cannot be opened by typing its url, and neither
 * can a page of a module the member has no access to (the menu hides those entries): the user is sent to the home page.
 */
export const menuEnabledGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  if (!isUrlOfEnabledMenuRoute(state.url)) {
    return router.createUrlTree(['/']);
  }

  const module = moduleOfUrl(state.url);
  if (module === undefined) {
    return true;
  }

  const permissions = inject(PermissionsService);
  const decide = (): true | UrlTree => (permissions.canRead(module) ? true : router.createUrlTree(['/']));
  // The roles of the member are known only once the full profile is loaded.
  const profile = loadFullProfileIfNeeded();
  return profile ? profile.pipe(map(decide)) : decide();
};
