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
    data: { breadcrumb: 'BREADCRUMB.CICLO_PASSIVO_SDI', title: 'Ciclo Passivo SDI' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'qr-scanner',
    data: { breadcrumb: 'BREADCRUMB.SCANNER_QR_AND_PAIN_001', title: 'Scanner QR & pain.001' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'orders',
    data: { breadcrumb: 'BREADCRUMB.ORDINI_DI_ACQUISTO', title: 'Ordini di acquisto', page: PURCHASE_ORDERS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'invoices',
    data: { breadcrumb: 'BREADCRUMB.FATTURE_FORNITORI', title: 'Fatture fornitori', page: PURCHASE_INVOICES_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'expenses',
    data: { breadcrumb: 'BREADCRUMB.NOTE_SPESE', title: 'Note Spese & Uscite' },
    loadComponent: () =>
      import('./components/expenses/expenses.component').then((m) => m.ExpensesComponent),
  },
];
