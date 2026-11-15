import { Routes } from '@angular/router';

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'ledger',
  },
  {
    path: 'ledger',
    data: { breadcrumb: 'Contabilità & Fiscale', title: 'Contabilità Dual-Ledger' },
    loadComponent: () =>
      import('./accounting.component').then((m) => m.AccountingComponent),
  },
  {
    path: 'tax/stamp-duty',
    data: { breadcrumb: 'Imposta di bollo', title: 'Imposta di bollo trimestrale' },
    loadComponent: () =>
      import('./tax/stamp-duty-report.component').then((m) => m.StampDutyReportComponent),
  },
  {
    path: 'tax/withholdings',
    data: { breadcrumb: "Ritenute d'acconto (CU)", title: "Ritenute d'acconto (CU)" },
    loadComponent: () =>
      import('./tax/withholding-report.component').then((m) => m.WithholdingReportComponent),
  },
  {
    path: 'tax/enasarco',
    data: { breadcrumb: 'ENASARCO', title: 'Situazione ENASARCO' },
    loadComponent: () =>
      import('./tax/enasarco-status.component').then((m) => m.EnasarcoStatusComponent),
  },
];
