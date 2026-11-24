import { computed, inject, Injectable } from '@angular/core';
import { AuthStore, PermissionsService } from '@core';

/** Roles that keep the register, the controls library, the audit plan and the calendar (mirrors GovernancePolicy). */
export const GOV_MANAGER_ROLES: readonly string[] = ['owner', 'admin', 'accountant'];

/** Roles that take the management decisions: accepting a risk, approving a plan, verifying an action. */
export const GOV_APPROVER_ROLES: readonly string[] = ['owner', 'admin'];

/** Whether the roles or the granted permissions open a governance ability: `<role list>` or `governance.<ability>`. */
export function govHasAbility(
  roles: readonly string[],
  permissions: readonly string[],
  allowedRoles: readonly string[],
  ability: 'manage' | 'approve',
): boolean {
  const memberRoles = roles.map((role) => role.trim().toLowerCase());
  if (memberRoles.some((role) => allowedRoles.includes(role))) {
    return true;
  }
  const granted = new Set(permissions.map((permission) => permission.trim().toLowerCase()));
  return granted.has('*') || granted.has(`governance.${ability}`) || granted.has('governance.*');
}

/**
 * What the current member may do in the governance screens. The API is the authority: this only decides which buttons
 * are shown.
 */
@Injectable({ providedIn: 'root' })
export class GovernanceAccess {
  private readonly authStore = inject(AuthStore);
  private readonly permissions = inject(PermissionsService);

  /** The member may write at all (read-only roles never do). */
  readonly canWrite = computed(() => {
    this.authStore.activeRoles();
    this.authStore.userPermissions();
    return this.permissions.canWrite('governance');
  });

  readonly canManage = computed(
    () =>
      this.canWrite() &&
      govHasAbility(this.authStore.activeRoles(), this.authStore.userPermissions(), GOV_MANAGER_ROLES, 'manage'),
  );

  readonly canApprove = computed(
    () =>
      this.canWrite() &&
      govHasAbility(this.authStore.activeRoles(), this.authStore.userPermissions(), GOV_APPROVER_ROLES, 'approve'),
  );

  /** The id of the signed-in user, to recognise the actions they own. */
  readonly userId = computed(() => this.authStore.user()?.id ?? '');
}
