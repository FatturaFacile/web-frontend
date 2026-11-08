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
    data: { breadcrumb: 'Preventivi & Ordini', title: 'Preventivi & Ordini' },
    loadComponent: () =>
      import('./components/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent),
  },
  {
    path: 'quotes',
    data: { breadcrumb: 'Preventivi', title: 'Preventivi' },
    loadComponent: () =>
      import('./components/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent),
  },
  {
    path: 'invoices',
    data: { breadcrumb: 'Fatture', title: 'Fatture' },
    loadComponent: () =>
      import('./components/invoices/invoices.component').then((m) => m.InvoicesComponent),
  },
  {
    path: 'qr-bill',
    data: { breadcrumb: 'Swiss QR-Bill', title: 'Swiss QR-Bill' },
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
    data: { breadcrumb: 'Fattura Elettronica SDI', title: 'Fattura Elettronica SDI' },
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
