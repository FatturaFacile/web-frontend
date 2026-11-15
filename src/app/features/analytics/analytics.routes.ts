import { Routes } from '@angular/router';
import { moduleGuard } from '@core';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.ANALYTICS_KPIS', title: 'NAV.ANALYTICS_KPIS' },
    loadComponent: () => import('./analytics.component').then((m) => m.AnalyticsComponent),
  },
  {
    path: 'designer',
    canActivate: [moduleGuard('analytics', 'read')],
    data: { breadcrumb: 'NAV.ANALYTICS_DESIGNER', title: 'NAV.ANALYTICS_DESIGNER' },
    loadComponent: () => import('./report-designer.component').then((m) => m.ReportDesignerComponent),
  },
  {
    path: 'exports',
    canActivate: [moduleGuard('analytics', 'read')],
    data: { breadcrumb: 'NAV.ANALYTICS_EXPORTS', title: 'NAV.ANALYTICS_EXPORTS' },
    loadComponent: () => import('./export-schedules.component').then((m) => m.ExportSchedulesComponent),
  },
  {
    path: 'snapshots',
    canActivate: [moduleGuard('analytics', 'read')],
    data: { breadcrumb: 'NAV.ANALYTICS_SNAPSHOTS', title: 'NAV.ANALYTICS_SNAPSHOTS' },
    loadComponent: () => import('./kpi-snapshots.component').then((m) => m.KpiSnapshotsComponent),
  },
];
