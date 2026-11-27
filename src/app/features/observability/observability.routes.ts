import { Routes } from '@angular/router';
import { platformAdminGuard } from '../../core/auth/auth.guard';

/** Observability (issue #448). The parent route requires a signed-in user; the profiler is for platform administrators only. */
export const OBSERVABILITY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'connectors' },
  {
    path: 'profiler',
    canActivate: [platformAdminGuard],
    data: {
      breadcrumb: 'NAV.OBSERVABILITY_PROFILER',
      title: 'PAGE_TITLE.OBSERVABILITY_PROFILER',
    },
    loadComponent: () => import('./profiler-page.component').then((m) => m.ProfilerPageComponent),
  },
  {
    path: 'connectors',
    data: {
      breadcrumb: 'NAV.CONNECTOR_STATUS',
      title: 'PAGE_TITLE.CONNECTOR_STATUS',
    },
    loadComponent: () =>
      import('./connector-status-page.component').then((m) => m.ConnectorStatusPageComponent),
  },
];
