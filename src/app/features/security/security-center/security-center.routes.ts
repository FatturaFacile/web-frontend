import { Routes } from '@angular/router';

/** Security, Privacy & Compliance Center (GitHub #224). The role check is made on the parent route in `app.routes.ts`. */
export const SECURITY_CENTER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./security-center-shell.component').then((m) => m.SecurityCenterShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'posture' },
      {
        path: 'posture',
        data: { breadcrumb: 'SECURITY_CENTER.TAB.POSTURE', title: 'SECURITY_CENTER.TITLE' },
        loadComponent: () =>
          import('./posture-dashboard.component').then((m) => m.PostureDashboardComponent),
      },
      {
        path: 'audit',
        data: { breadcrumb: 'SECURITY_CENTER.TAB.AUDIT', title: 'SECURITY_CENTER.TITLE' },
        loadComponent: () =>
          import('./audit-explorer.component').then((m) => m.AuditExplorerComponent),
      },
      {
        path: 'privacy',
        data: { breadcrumb: 'SECURITY_CENTER.TAB.PRIVACY', title: 'SECURITY_CENTER.TITLE' },
        loadComponent: () =>
          import('./privacy-console-shell.component').then((m) => m.PrivacyConsoleShellComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'ropa' },
          {
            path: 'ropa',
            loadComponent: () =>
              import('../../privacy-governance/ropa-registry.component').then(
                (m) => m.RopaRegistryComponent,
              ),
          },
          {
            path: 'consents',
            loadComponent: () =>
              import('../../privacy-governance/consent-and-retention.component').then(
                (m) => m.ConsentAndRetentionComponent,
              ),
          },
          {
            path: 'dsar',
            loadComponent: () =>
              import('./dsar-wizard.component').then((m) => m.DsarWizardComponent),
          },
          {
            path: 'retention',
            loadComponent: () =>
              import('./retention-matrix.component').then((m) => m.RetentionMatrixComponent),
          },
        ],
      },
      {
        path: 'breaches',
        data: { breadcrumb: 'SECURITY_CENTER.TAB.BREACHES', title: 'SECURITY_CENTER.TITLE' },
        loadComponent: () => import('./breach-board.component').then((m) => m.BreachBoardComponent),
      },
    ],
  },
];
