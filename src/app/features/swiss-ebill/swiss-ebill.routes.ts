import { Routes } from '@angular/router';

/** Swiss eBill (Mod 025). The parent route guards the module (see `app.routes.ts`). */
export const SWISS_EBILL_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    data: {
      breadcrumb: 'NAV.SWISS_EBILL_DASHBOARD',
      title: 'PAGE_TITLE.SWISS_EBILL_DASHBOARD',
    },
    loadComponent: () =>
      import('./ebill-dashboard.component').then((m) => m.EbillDashboardComponent),
  },
  {
    path: 'settings',
    data: {
      breadcrumb: 'NAV.SWISS_EBILL_SETTINGS',
      title: 'PAGE_TITLE.SWISS_EBILL_SETTINGS',
    },
    loadComponent: () => import('./ebill-settings.component').then((m) => m.EbillSettingsComponent),
  },
];
