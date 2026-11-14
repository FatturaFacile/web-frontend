import { Routes } from '@angular/router';

export const LEASE_ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./lease-list.component').then((m) => m.LeaseListComponent),
  },
  {
    path: 'maturity',
    data: { breadcrumb: 'NAV.LEASES_MATURITY', title: 'LEASES.MATURITY_TITLE' },
    loadComponent: () => import('./lease-maturity-report.component').then((m) => m.LeaseMaturityReportComponent),
  },
  {
    path: ':id',
    data: { breadcrumb: 'LEASES.DETAIL', title: 'LEASES.TITLE' },
    loadComponent: () => import('./lease-detail.component').then((m) => m.LeaseDetailComponent),
  },
];
