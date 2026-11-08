import { inject, Injectable } from '@angular/core';
import { AuthStore } from './auth.store';
import { AccessMode, canAccessModule, MODULE_ACCESS, READ_ONLY_ROLES } from './permissions';

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  private readonly authStore = inject(AuthStore);

  /**
   * Checks whether the current user has access (read or write) to the specified ERP module
   * under the active tenant context.
   */
  hasAccess(module: string, mode: AccessMode = 'read'): boolean {
    const roles = this.authStore.activeRoles();
    const permissions = this.authStore.userPermissions();
    return canAccessModule(module, mode, roles, permissions);
  }

  canRead(module: string): boolean {
    return this.hasAccess(module, 'read');
  }

  canWrite(module: string): boolean {
    return this.hasAccess(module, 'write');
  }

  isReadOnlyRole(): boolean {
    const role = this.authStore.activeRole();
    return READ_ONLY_ROLES.includes(role.toLowerCase());
  }

  getAvailableModules(): readonly string[] {
    return Object.keys(MODULE_ACCESS);
  }
}
