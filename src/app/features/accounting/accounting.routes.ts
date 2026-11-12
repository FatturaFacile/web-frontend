import { Routes } from '@angular/router';

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'ledger',
  },
  {
    path: 'ledger',
    data: { breadcrumb: 'BREADCRUMB.CONTABILITA_AND_FISCALE', title: 'PAGE_TITLE.CONTABILITA_DUAL_LEDGER' },
    loadComponent: () =>
      import('./accounting.component').then((m) => m.AccountingComponent),
  },
];
