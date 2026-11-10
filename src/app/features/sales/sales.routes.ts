import { Routes } from '@angular/router';
import { QR_BILL_REPOSITORY } from '@domain/repositories/qr-bill.repository';
import { QrBillHttpRepository } from '@data-access/repositories/qr-bill-http.repository';
import { QrBillStore } from './state/qr-bill.store';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'orders',
  },
  {
    path: 'orders',
    data: { breadcrumb: 'BREADCRUMB.PREVENTIVI_AND_ORDINI', title: 'Preventivi & Ordini' },
    loadComponent: () =>
      import('./components/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent),
  },
  {
    path: 'quotes',
    data: { breadcrumb: 'BREADCRUMB.PREVENTIVI', title: 'Preventivi' },
    loadComponent: () =>
      import('./components/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent),
  },
  {
    path: 'cycle',
    data: { breadcrumb: 'BREADCRUMB.CICLO_VENDITE', title: 'Ciclo vendite' },
    loadChildren: () => import('./cycle/cycle.routes').then((m) => m.CYCLE_ROUTES),
  },
  {
    path: 'billing',
    data: { breadcrumb: 'BREADCRUMB.FATTURAZIONE', title: 'Fatturazione' },
    loadChildren: () => import('./billing/billing.routes').then((m) => m.BILLING_ROUTES),
  },
  {
    path: 'invoices',
    data: { breadcrumb: 'BREADCRUMB.FATTURE', title: 'Fatture' },
    loadComponent: () =>
      import('./components/invoices/invoices.component').then((m) => m.InvoicesComponent),
  },
  {
    path: 'qr-bill',
    data: { breadcrumb: 'BREADCRUMB.SWISS_QR_BILL', title: 'Swiss QR-Bill' },
    providers: [
      { provide: QR_BILL_REPOSITORY, useClass: QrBillHttpRepository },
      QrBillStore,
    ],
    loadComponent: () =>
      import('./components/swiss-qr-bill/swiss-qr-bill.component').then(
        (m) => m.SwissQrBillComponent
      ),
  },
  {
    path: 'sdi',
    data: { breadcrumb: 'BREADCRUMB.FATTURA_ELETTRONICA_SDI', title: 'Fattura Elettronica SDI' },
    providers: [
      { provide: QR_BILL_REPOSITORY, useClass: QrBillHttpRepository },
      QrBillStore,
    ],
    loadComponent: () =>
      import('./components/swiss-qr-bill/swiss-qr-bill.component').then(
        (m) => m.SwissQrBillComponent
      ),
  },
];
