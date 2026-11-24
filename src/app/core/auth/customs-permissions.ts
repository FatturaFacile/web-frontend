/** Permission slug that unlocks writing the customs catalogs (TARIC codes, free trade agreements). */
export const CUSTOMS_MANAGE_PERMISSION = 'customs.manage';

/**
 * Whether a member may write the customs catalogs. Mirrors the API gate `customs.manage`
 * (`User::hasTenantPermission`): owners and admins always can, anyone else needs the slug (or `*`) in the
 * permissions of the membership. The API stays the authority (403); this only decides what the UI shows.
 */
export function canManageCustoms(roles: readonly string[], permissions: readonly string[] = []): boolean {
  const normalizedRoles = roles.map((role) => role.toLowerCase());
  if (normalizedRoles.includes('owner') || normalizedRoles.includes('admin')) {
    return true;
  }
  const granted = permissions.map((permission) => permission.toLowerCase());
  return granted.includes(CUSTOMS_MANAGE_PERMISSION) || granted.includes('*');
}
