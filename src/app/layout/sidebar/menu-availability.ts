/**
 * Routes of the menu entries that have been tested and can be opened from the menu.
 *
 * Every other entry is shown greyed out and cannot be clicked, so the pages that are still to be tested are not
 * reachable by mistake. To enable an entry, add its route (the `route` of the entry in `sidebar.component.ts`) here;
 * a group is enabled as soon as one of its entries is. The pages are locked by URL too: menuEnabledGuard (core/auth) sends a disabled page to the home page.
 */
export const TESTED_MENU_ROUTES: readonly string[] = [
  // '/workspace',
  // '/system',
  // '/settings/admin/access-requests',
  // '/settings/lookups',
  '/crm/clients',
];

export function isMenuRouteTested(
  route: string | undefined,
  tested: readonly string[] = TESTED_MENU_ROUTES,
): boolean {
  return route !== undefined && tested.includes(route);
}

/** Lower case without accents, so that "contabilita" finds "Contabilità". */
export function normalizeMenuSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
