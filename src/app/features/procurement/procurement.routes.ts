import { Routes } from '@angular/router';
import { PROCUREMENT_ADMIN_PAGE } from './admin.page';
import { PROCUREMENT_ORDERS_PAGE } from './orders.page';
import { SOURCING_PAGE } from './sourcing.page';
import { SUPPLIERS_PAGE } from './suppliers.page';

const procurementRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  data: { breadcrumb, title: breadcrumb, page },
  loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
});

export const PROCUREMENT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'suppliers' },
  procurementRoute('suppliers', 'Fornitori & Qualifica', SUPPLIERS_PAGE),
  procurementRoute('sourcing', 'Sourcing & Contratti', SOURCING_PAGE),
  {
    path: 'requisitions',
    data: { breadcrumb: 'PR.TITLE', title: 'PR.TITLE' },
    loadComponent: () =>
      import('./requisitions/pr-list-page.component').then((m) => m.PrListPageComponent),
  },
  {
    path: 'requisitions/new',
    data: { breadcrumb: 'PR.CREATE_TITLE', title: 'PR.CREATE_TITLE' },
    loadComponent: () =>
      import('./requisitions/pr-form-page.component').then((m) => m.PrFormPageComponent),
  },
  {
    path: 'requisitions/convert',
    data: { breadcrumb: 'PR.CONVERT.TITLE', title: 'PR.CONVERT.TITLE' },
    loadComponent: () =>
      import('./requisitions/pr-convert-workbench.component').then(
        (m) => m.PrConvertWorkbenchComponent,
      ),
  },
  {
    path: 'requisitions/:id/edit',
    data: { breadcrumb: 'PR.EDIT_TITLE', title: 'PR.EDIT_TITLE' },
    loadComponent: () =>
      import('./requisitions/pr-form-page.component').then((m) => m.PrFormPageComponent),
  },
  {
    path: 'requisitions/:id',
    data: { breadcrumb: 'PR.DETAIL.TITLE', title: 'PR.DETAIL.TITLE' },
    loadComponent: () =>
      import('./requisitions/pr-detail-page.component').then((m) => m.PrDetailPageComponent),
  },
  {
    path: 'rfqs',
    data: { breadcrumb: 'RFQ.TITLE', title: 'RFQ.TITLE' },
    loadComponent: () =>
      import('./rfq/rfq-list-page.component').then((m) => m.RfqListPageComponent),
  },
  {
    path: 'rfqs/new',
    data: { breadcrumb: 'RFQ.CREATE_TITLE', title: 'RFQ.CREATE_TITLE' },
    loadComponent: () =>
      import('./rfq/rfq-wizard.component').then((m) => m.RfqWizardComponent),
  },
  {
    path: 'rfqs/:id/edit',
    data: { breadcrumb: 'RFQ.EDIT_TITLE', title: 'RFQ.EDIT_TITLE' },
    loadComponent: () =>
      import('./rfq/rfq-wizard.component').then((m) => m.RfqWizardComponent),
  },
  {
    path: 'rfqs/:id/matrix',
    data: { breadcrumb: 'RFQ.MATRIX.TITLE', title: 'RFQ.MATRIX.TITLE' },
    loadComponent: () =>
      import('./rfq/bid-comparison-matrix.component').then((m) => m.BidComparisonMatrixComponent),
  },
  { path: 'rfqs/:id', pathMatch: 'full', redirectTo: '/procurement/rfqs/:id/matrix' },
  procurementRoute('orders', 'Ordini & Ricevimenti', PROCUREMENT_ORDERS_PAGE),
  procurementRoute('admin', 'Regole & Analisi', PROCUREMENT_ADMIN_PAGE),
];
