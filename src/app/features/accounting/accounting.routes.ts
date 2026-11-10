import { Routes } from '@angular/router';

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'ledger',
  },
  {
    path: 'ledger',
    data: { breadcrumb: 'BREADCRUMB.CONTABILITA_AND_FISCALE', title: 'Contabilità Dual-Ledger' },
    loadComponent: () =>
      import('./accounting.component').then((m) => m.AccountingComponent),
  },
];
