import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'BREADCRUMB.DASHBOARD', title: 'Dashboard Esecutiva' },
    loadComponent: () =>
      import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'customize',
    data: { breadcrumb: 'DASHBOARD_BUILDER.TITLE', titleKey: 'DASHBOARD_BUILDER.TITLE' },
    loadComponent: () =>
      import('./builder/dashboard-builder.component').then((m) => m.DashboardBuilderComponent),
  },
];
