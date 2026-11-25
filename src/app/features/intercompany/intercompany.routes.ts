import { Routes } from '@angular/router';

/** Intercompany accounting and group consolidation (Mod 021). The parent route guards the module (see `app.routes.ts`). */
export const INTERCOMPANY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./intercompany-shell.component').then((m) => m.IntercompanyShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { breadcrumb: 'NAV.INTERCOMPANY_STRUCTURE', title: 'PAGE_TITLE.INTERCOMPANY_STRUCTURE' },
        loadComponent: () => import('./intercompany-structure.component').then((m) => m.IntercompanyStructureComponent),
      },
      {
        path: 'transactions',
        data: { breadcrumb: 'NAV.INTERCOMPANY_TRANSACTIONS', title: 'PAGE_TITLE.INTERCOMPANY_TRANSACTIONS' },
        loadComponent: () => import('./intercompany-transactions.component').then((m) => m.IntercompanyTransactionsComponent),
      },
      {
        path: 'reconciliation',
        data: { breadcrumb: 'NAV.INTERCOMPANY_RECONCILIATION', title: 'PAGE_TITLE.INTERCOMPANY_RECONCILIATION' },
        loadComponent: () => import('./intercompany-reconciliation.component').then((m) => m.IntercompanyReconciliationComponent),
      },
      {
        path: 'consolidation',
        data: { breadcrumb: 'NAV.INTERCOMPANY_CONSOLIDATION', title: 'PAGE_TITLE.INTERCOMPANY_CONSOLIDATION' },
        loadComponent: () => import('./intercompany-run.component').then((m) => m.IntercompanyRunComponent),
      },
      {
        path: 'statements',
        data: { breadcrumb: 'NAV.INTERCOMPANY_STATEMENTS', title: 'PAGE_TITLE.INTERCOMPANY_STATEMENTS' },
        loadComponent: () => import('./intercompany-statements.component').then((m) => m.IntercompanyStatementsComponent),
      },
    ],
  },
];
