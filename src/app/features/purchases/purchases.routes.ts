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
    data: { breadcrumb: 'Ciclo Passivo SDI', title: 'Ciclo Passivo SDI' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'qr-scanner',
    data: { breadcrumb: 'Scanner QR & pain.001', title: 'Scanner QR & pain.001' },
    loadComponent: () =>
      import('./purchases.component').then((m) => m.PurchasesComponent),
  },
  {
    path: 'orders',
    data: { breadcrumb: 'Ordini di acquisto', title: 'Ordini di acquisto', page: PURCHASE_ORDERS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'invoices',
    data: { breadcrumb: 'Fatture fornitori', title: 'Fatture fornitori', page: PURCHASE_INVOICES_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'expenses',
    data: { breadcrumb: 'Note Spese', title: 'Note Spese & Uscite' },
    loadComponent: () =>
      import('./components/expenses/expenses.component').then((m) => m.ExpensesComponent),
  },
];
