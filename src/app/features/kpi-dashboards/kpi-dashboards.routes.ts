import { Routes } from '@angular/router';

export const KPI_DASHBOARDS_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'KPI_DASHBOARDS.TITLE', title: 'KPI_DASHBOARDS.TITLE' },
    loadComponent: () =>
      import('./kpi-dashboards-page.component').then((m) => m.KpiDashboardsPageComponent),
  },
];
