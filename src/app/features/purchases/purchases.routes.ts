import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { PURCHASE_INVOICES_PAGE, PURCHASE_ORDERS_PAGE } from './purchases-ledger.page';

export const PURCHASES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'sdi-inbox',
  },
  {
    path: 'sdi-inbox',
    data: { breadcrumb: 'BREADCRUMB.CICLO_PASSIVO_SDI', title: 'PAGE_TITLE.CICLO_PASSIVO_SDI' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'qr-scanner',
    data: { breadcrumb: 'BREADCRUMB.SCANNER_QR_AND_PAIN_001', title: 'PAGE_TITLE.SCANNER_QR_PAIN_001' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'orders',
    data: { breadcrumb: 'BREADCRUMB.ORDINI_DI_ACQUISTO', title: 'PAGE_TITLE.ORDINI_DI_ACQUISTO', page: PURCHASE_ORDERS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'invoices',
    data: { breadcrumb: 'BREADCRUMB.FATTURE_FORNITORI', title: 'PAGE_TITLE.FATTURE_FORNITORI', page: PURCHASE_INVOICES_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'expenses',
    data: { breadcrumb: 'BREADCRUMB.NOTE_SPESE', title: 'PAGE_TITLE.NOTE_SPESE_USCITE' },
    loadComponent: () =>
      import('./components/expenses/expenses.component').then((m) => m.ExpensesComponent),
  },
];
