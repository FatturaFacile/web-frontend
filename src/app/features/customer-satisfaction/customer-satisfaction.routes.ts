import { Routes } from '@angular/router';

/** Customer satisfaction (Mod 245). The parent route guards the module (see `app.routes.ts`). */
export const CUSTOMER_SATISFACTION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    data: {
      breadcrumb: 'NAV.CUSTOMER_SATISFACTION_DASHBOARD',
      title: 'PAGE_TITLE.CUSTOMER_SATISFACTION_DASHBOARD',
    },
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'recovery',
    data: {
      breadcrumb: 'NAV.CUSTOMER_SATISFACTION_RECOVERY',
      title: 'PAGE_TITLE.CUSTOMER_SATISFACTION_RECOVERY',
    },
    loadComponent: () => import('./recovery.component').then((m) => m.RecoveryComponent),
  },
  {
    path: 'templates',
    data: {
      breadcrumb: 'NAV.CUSTOMER_SATISFACTION_TEMPLATES',
      title: 'PAGE_TITLE.CUSTOMER_SATISFACTION_TEMPLATES',
    },
    loadComponent: () => import('./templates.component').then((m) => m.TemplatesComponent),
  },
  {
    path: 'dispatches',
    data: {
      breadcrumb: 'NAV.CUSTOMER_SATISFACTION_DISPATCHES',
      title: 'PAGE_TITLE.CUSTOMER_SATISFACTION_DISPATCHES',
    },
    loadComponent: () => import('./dispatches.component').then((m) => m.DispatchesComponent),
  },
];
