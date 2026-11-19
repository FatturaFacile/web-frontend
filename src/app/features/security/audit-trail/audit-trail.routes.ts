import { Routes } from '@angular/router';

export const AUDIT_TRAIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./audit-trail-shell.component').then((m) => m.AuditTrailShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { breadcrumb: 'NAV.AUDIT_TRAIL', title: 'PAGE_TITLE.AUDIT_TRAIL' },
        loadComponent: () =>
          import('./audit-trail-list.component').then((m) => m.AuditTrailListComponent),
      },
      {
        path: 'worm',
        data: { breadcrumb: 'AUDIT.TAB.WORM', title: 'PAGE_TITLE.AUDIT_TRAIL' },
        loadComponent: () =>
          import('./audit-worm-batches.component').then((m) => m.AuditWormBatchesComponent),
      },
    ],
  },
];
