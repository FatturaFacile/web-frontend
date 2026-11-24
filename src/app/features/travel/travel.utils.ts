import { TravelBalanceDirection, TravelTripStatus } from '@core';

/** The part of the auth store the travel access check reads. */
export interface TravelAccessSource {
  activeRoles(): readonly string[];
  user(): { permissions?: readonly string[] } | null;
}

/** Roles that see every trip, approve trips and maintain the rate tables (TravelTripPolicy::ManagerRoles). */
export const TRAVEL_MANAGER_ROLES: readonly string[] = ['owner', 'admin', 'hr', 'accountant'];

/** Roles that record the advance and reconcile (TravelTripPolicy::FinanceRoles). */
export const TRAVEL_FINANCE_ROLES: readonly string[] = ['owner', 'admin', 'accountant'];

/** Ant Design tag colour of a trip status. */
export const TRAVEL_STATUS_COLORS: Readonly<Record<TravelTripStatus, string>> = {
  draft: 'default',
  submitted: 'processing',
  approved: 'success',
  rejected: 'error',
  completed: 'blue',
  reconciled: 'purple',
};

export const TRAVEL_DIRECTION_COLORS: Readonly<Record<TravelBalanceDirection, string>> = {
  owed_to_employee: 'green',
  owed_by_employee: 'red',
  settled: 'default',
};

/** Whether the active member has one of the roles or a granted permission (`travel.<name>` or `travel.*`). */
export function hasTravelAccess(
  store: TravelAccessSource,
  roles: readonly string[],
  permissionName: string,
): boolean {
  const memberRoles = store.activeRoles().map((role) => role.trim().toLowerCase());
  const granted = (store.user()?.permissions ?? []).map((name) => name.trim().toLowerCase());

  return (
    memberRoles.some((role) => roles.includes(role)) ||
    granted.includes('*') ||
    granted.includes('travel.*') ||
    granted.includes(`travel.${permissionName}`)
  );
}

/** Current year, the default of the rate tables. */
export function currentYear(): number {
  return new Date().getFullYear();
}
