import { Routes } from '@angular/router';
import { CrisisMonitoringStore } from './crisis-monitoring.store';

export const CRISIS_MONITORING_ROUTES: Routes = [
  {
    path: '',
    providers: [CrisisMonitoringStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { breadcrumb: 'NAV.CRISIS_MONITORING', title: 'PAGE_TITLE.CRISIS_MONITORING' },
        loadComponent: () =>
          import('./crisis-monitoring.component').then((m) => m.CrisisMonitoringComponent),
      },
    ],
  },
];
