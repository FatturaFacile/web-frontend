import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Dashboard', title: 'Dashboard Esecutiva' },
    loadComponent: () =>
      import('./dashboard.component').then((m) => m.DashboardComponent),
  },
];
