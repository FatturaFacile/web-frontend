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
    data: { breadcrumb: 'BREADCRUMB.PREVENTIVI_AND_ORDINI', title: 'PAGE_TITLE.PREVENTIVI_ORDINI' },
    loadComponent: () =>
      import('./components/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent),
  },
  {
    path: 'quotes',
    data: { breadcrumb: 'BREADCRUMB.PREVENTIVI', title: 'PAGE_TITLE.PREVENTIVI' },
    loadComponent: () =>
      import('./components/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent),
  },
  {
    path: 'workspace/orders',
    data: { breadcrumb: 'BREADCRUMB.SWK_ORDERS', title: 'PAGE_TITLE.SWK_ORDERS' },
    loadComponent: () =>
      import('./workspace/sales-orders-workspace.component').then((m) => m.SalesOrdersWorkspaceComponent),
  },
  {
    path: 'workspace/orders/:id',
    data: { breadcrumb: 'BREADCRUMB.SWK_ORDER', title: 'PAGE_TITLE.SWK_ORDERS' },
    loadComponent: () =>
      import('./workspace/sales-order-workspace-detail.component').then(
        (m) => m.SalesOrderWorkspaceDetailComponent
      ),
  },
  {
    path: 'blanket-agreements',
    data: { breadcrumb: 'BREADCRUMB.SWK_BLANKET', title: 'PAGE_TITLE.SWK_BLANKET' },
    loadComponent: () =>
      import('./workspace/blanket-agreements.component').then((m) => m.BlanketAgreementsComponent),
  },
  {
    path: 'backorders',
    data: { breadcrumb: 'BREADCRUMB.SWK_BACKORDERS', title: 'PAGE_TITLE.SWK_BACKORDERS' },
    loadComponent: () =>
      import('./workspace/backorder-monitor.component').then((m) => m.BackorderMonitorComponent),
  },
  {
    path: 'cycle',
    data: { breadcrumb: 'BREADCRUMB.CICLO_VENDITE', title: 'PAGE_TITLE.CICLO_VENDITE' },
    loadChildren: () => import('./cycle/cycle.routes').then((m) => m.CYCLE_ROUTES),
  },
  {
    path: 'billing',
    data: { breadcrumb: 'BREADCRUMB.FATTURAZIONE', title: 'PAGE_TITLE.FATTURAZIONE' },
    loadChildren: () => import('./billing/billing.routes').then((m) => m.BILLING_ROUTES),
  },
  {
    path: 'invoices',
    data: { breadcrumb: 'BREADCRUMB.FATTURE', title: 'PAGE_TITLE.FATTURE' },
    loadComponent: () =>
      import('./components/invoices/invoices.component').then((m) => m.InvoicesComponent),
  },
  {
    path: 'qr-bill',
    data: { breadcrumb: 'BREADCRUMB.SWISS_QR_BILL', title: 'PAGE_TITLE.SWISS_QR_BILL' },
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
    data: { breadcrumb: 'BREADCRUMB.FATTURA_ELETTRONICA_SDI', title: 'PAGE_TITLE.FATTURA_ELETTRONICA_SDI' },
    loadComponent: () =>
      import('../sdi-transmissions/sdi-transmissions.component').then(
        (m) => m.SdiTransmissionsComponent
      ),
  },
  {
    path: 'recurring-contracts',
    data: {
      breadcrumb: 'NAV.RECURRING_CONTRACTS',
      title: 'PAGE_TITLE.RECURRING_CONTRACTS',
    },
    loadComponent: () =>
      import('./recurring-contracts/recurring-contracts-list.component').then(
        (m) => m.RecurringContractsListComponent
      ),
  },
  {
    path: 'omnichannel-pipeline',
    data: {
      breadcrumb: 'BREADCRUMB.OMNICHANNEL_PIPELINE',
      title: 'PAGE_TITLE.OMNICHANNEL_PIPELINE',
    },
    loadComponent: () =>
      import('./omnichannel-cockpit/sales-bounded-context-cockpit.component').then(
        (m) => m.SalesBoundedContextCockpitComponent
      ),
  },
];
