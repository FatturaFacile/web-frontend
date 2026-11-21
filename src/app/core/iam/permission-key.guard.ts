import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { PermissionStore } from './permission.store';

/**
 * Route guard on permission keys: `canMatch: [permissionKeyGuard('settings.roles.view')]`. The snapshot is loaded first,
 * so a cold refresh does not bounce the user; a missing permission redirects to the dashboard (deny by default).
 */
export const permissionKeyGuard =
  (...keys: string[]): CanMatchFn =>
  async () => {
    const store = inject(PermissionStore);
    const router = inject(Router);

    await store.load();

    return store.hasAnyPermission(keys) ? true : router.createUrlTree(['/']);
  };
