import { Routes } from '@angular/router';

export const RECEIVABLES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.RECEIVABLES_DASHBOARD', title: 'PAGE_TITLE.RECEIVABLES_DASHBOARD' },
    loadComponent: () =>
      import('./receivables-dashboard.component').then((m) => m.ReceivablesDashboardComponent),
  },
  {
    path: 'items',
    data: { breadcrumb: 'NAV.RECEIVABLES_ITEMS', title: 'PAGE_TITLE.RECEIVABLES_ITEMS' },
    loadComponent: () =>
      import('./receivables-items.component').then((m) => m.ReceivablesItemsComponent),
  },
  {
    path: 'ledger',
    data: { breadcrumb: 'NAV.RECEIVABLES_LEDGER', title: 'PAGE_TITLE.RECEIVABLES_LEDGER' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./customer-ledger.component').then((m) => m.CustomerLedgerComponent),
      },
      {
        path: ':customerId',
        loadComponent: () =>
          import('./customer-ledger.component').then((m) => m.CustomerLedgerComponent),
      },
    ],
  },
  {
    path: 'credit',
    data: { breadcrumb: 'NAV.RECEIVABLES_CREDIT', title: 'PAGE_TITLE.RECEIVABLES_CREDIT' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./credit-position.component').then((m) => m.CreditPositionComponent),
      },
      {
        path: ':customerId',
        loadComponent: () =>
          import('./credit-position.component').then((m) => m.CreditPositionComponent),
      },
    ],
  },
  {
    path: 'statement',
    data: { breadcrumb: 'NAV.RECEIVABLES_STATEMENT', title: 'PAGE_TITLE.RECEIVABLES_STATEMENT' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./customer-statement.component').then((m) => m.CustomerStatementComponent),
      },
      {
        path: ':customerId',
        loadComponent: () =>
          import('./customer-statement.component').then((m) => m.CustomerStatementComponent),
      },
    ],
  },
];
