import { Routes } from '@angular/router';

export const DIGITAL_PRESERVATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./digital-preservation-shell.component').then(
        (m) => m.DigitalPreservationShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        data: { breadcrumb: 'PRESERVATION.TAB_DASHBOARD', title: 'PRESERVATION.TITLE' },
        loadComponent: () =>
          import('./preservation-dashboard.component').then(
            (m) => m.PreservationDashboardComponent,
          ),
      },
      {
        path: 'batches',
        data: { breadcrumb: 'PRESERVATION.TAB_BATCHES', title: 'PRESERVATION.TITLE' },
        loadComponent: () =>
          import('./preservation-batches.component').then((m) => m.PreservationBatchesComponent),
      },
      {
        path: 'exhibition',
        data: { breadcrumb: 'PRESERVATION.TAB_EXHIBITION', title: 'PRESERVATION.TITLE' },
        loadComponent: () =>
          import('./preservation-exhibition.component').then(
            (m) => m.PreservationExhibitionComponent,
          ),
      },
      {
        path: 'configuration',
        data: { breadcrumb: 'PRESERVATION.TAB_CONFIGURATION', title: 'PRESERVATION.TITLE' },
        loadComponent: () =>
          import('./preservation-configuration.component').then(
            (m) => m.PreservationConfigurationComponent,
          ),
      },
      {
        path: 'audit',
        data: { breadcrumb: 'PRESERVATION.TAB_AUDIT', title: 'PRESERVATION.TITLE' },
        loadComponent: () =>
          import('./preservation-audit.component').then((m) => m.PreservationAuditComponent),
      },
    ],
  },
];
