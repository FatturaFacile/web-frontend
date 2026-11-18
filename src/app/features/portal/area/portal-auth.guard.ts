import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortalSessionService } from './portal-session.service';

/** Lets a signed-in portal customer through; anyone else goes to `/portal/login`, keeping the portal slug. */
export const portalAuthGuard: CanActivateFn = () => {
  const session = inject(PortalSessionService);
  if (session.isAuthenticated()) {
    return true;
  }
  session.clear();
  return inject(Router).createUrlTree(['/portal/login'], {
    queryParams: session.slug() ? { portal: session.slug() } : {},
  });
};
