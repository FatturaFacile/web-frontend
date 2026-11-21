import { Routes } from '@angular/router';

export const DATA_SOVEREIGNTY_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'DATA_SOVEREIGNTY.TITLE', title: 'DATA_SOVEREIGNTY.TITLE' },
    loadComponent: () =>
      import('./data-sovereignty-dashboard.component').then(
        (m) => m.DataSovereigntyDashboardComponent,
      ),
  },
  {
    path: 'keys',
    data: { breadcrumb: 'DATA_SOVEREIGNTY.KEYS_TITLE', title: 'DATA_SOVEREIGNTY.KEYS_TITLE' },
    loadComponent: () =>
      import('./byok-key-management.component').then((m) => m.ByokKeyManagementComponent),
  },
  {
    path: 'egress',
    data: { breadcrumb: 'DATA_SOVEREIGNTY.EGRESS_TITLE', title: 'DATA_SOVEREIGNTY.EGRESS_TITLE' },
    loadComponent: () =>
      import('./cross-border-egress-guard.component').then(
        (m) => m.CrossBorderEgressGuardComponent,
      ),
  },
];
