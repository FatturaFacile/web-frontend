import { Routes } from '@angular/router';
import { moduleGuard } from '@core/auth/auth.guard';
import { ESIG_CONFIGURE_MODULE } from './e-signature.util';

/** Electronic signatures (FES / FEA / FEQ). The parent route guards the module (see `app.routes.ts`). */
export const E_SIGNATURE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.SIGNATURES_CENTER', title: 'PAGE_TITLE.SIGNATURES_CENTER' },
    loadComponent: () =>
      import('./signature-center.component').then((m) => m.SignatureCenterComponent),
  },
  {
    // Provider credentials and compliance rules: owners and administrators.
    path: 'settings',
    canActivate: [moduleGuard(ESIG_CONFIGURE_MODULE)],
    data: { breadcrumb: 'NAV.SIGNATURES_SETTINGS', title: 'PAGE_TITLE.SIGNATURES_SETTINGS' },
    loadComponent: () =>
      import('./signature-settings.component').then((m) => m.SignatureSettingsComponent),
  },
];
