import { Routes } from '@angular/router';

/** Corporate conventions (Mod 358). The parent route guards the module (see `app.routes.ts`). */
export const CORPORATE_CONVENTIONS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.CORPORATE_CONVENTIONS_LIST',
      title: 'PAGE_TITLE.CORPORATE_CONVENTIONS',
    },
    loadComponent: () => import('./conventions.component').then((m) => m.ConventionsComponent),
  },
  {
    path: 'dashboard',
    data: {
      breadcrumb: 'NAV.CORPORATE_CONVENTIONS_DASHBOARD',
      title: 'PAGE_TITLE.CORPORATE_CONVENTIONS_DASHBOARD',
    },
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'billing-reconciliation',
    data: {
      breadcrumb: 'NAV.CORPORATE_CONVENTIONS_BILLING',
      title: 'PAGE_TITLE.CORPORATE_CONVENTIONS_BILLING',
    },
    loadComponent: () =>
      import('./billing-reconciliation.component').then((m) => m.BillingReconciliationComponent),
  },
];
