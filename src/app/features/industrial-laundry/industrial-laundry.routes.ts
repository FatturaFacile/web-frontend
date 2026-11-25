import { Routes } from '@angular/router';

/** Industrial laundries and linen rental (Mod 177). The parent route guards the module (see `app.routes.ts`). */
export const INDUSTRIAL_LAUNDRY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.INDUSTRIAL_LAUNDRY_PAR_STOCK',
      title: 'PAGE_TITLE.INDUSTRIAL_LAUNDRY_PAR_STOCK',
    },
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'lockers',
    data: {
      breadcrumb: 'NAV.INDUSTRIAL_LAUNDRY_LOCKERS',
      title: 'PAGE_TITLE.INDUSTRIAL_LAUNDRY_LOCKERS',
    },
    loadComponent: () => import('./lockers.component').then((m) => m.LockersComponent),
  },
  {
    path: 'ppe',
    data: {
      breadcrumb: 'NAV.INDUSTRIAL_LAUNDRY_PPE',
      title: 'PAGE_TITLE.INDUSTRIAL_LAUNDRY_PPE',
    },
    loadComponent: () => import('./ppe-monitor.component').then((m) => m.PpeMonitorComponent),
  },
  {
    path: 'dormant',
    data: {
      breadcrumb: 'NAV.INDUSTRIAL_LAUNDRY_DORMANT',
      title: 'PAGE_TITLE.INDUSTRIAL_LAUNDRY_DORMANT',
    },
    loadComponent: () => import('./dormant.component').then((m) => m.DormantComponent),
  },
  {
    path: 'rabc',
    data: {
      breadcrumb: 'NAV.INDUSTRIAL_LAUNDRY_RABC',
      title: 'PAGE_TITLE.INDUSTRIAL_LAUNDRY_RABC',
    },
    loadComponent: () => import('./rabc-console.component').then((m) => m.RabcConsoleComponent),
  },
  {
    path: 'billing',
    data: {
      breadcrumb: 'NAV.INDUSTRIAL_LAUNDRY_BILLING',
      title: 'PAGE_TITLE.INDUSTRIAL_LAUNDRY_BILLING',
    },
    loadComponent: () => import('./billing.component').then((m) => m.BillingComponent),
  },
];
