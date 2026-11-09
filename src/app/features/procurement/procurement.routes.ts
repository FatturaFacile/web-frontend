import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { PROCUREMENT_ADMIN_PAGE } from './admin.page';
import { PROCUREMENT_ORDERS_PAGE } from './orders.page';
import { SOURCING_PAGE } from './sourcing.page';
import { SUPPLIERS_PAGE } from './suppliers.page';

const procurementRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  data: { breadcrumb, title: breadcrumb, page },
  component: ResourcePageComponent,
});

export const PROCUREMENT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'suppliers' },
  procurementRoute('suppliers', 'Fornitori & Qualifica', SUPPLIERS_PAGE),
  procurementRoute('sourcing', 'Sourcing & Contratti', SOURCING_PAGE),
  procurementRoute('orders', 'Ordini & Ricevimenti', PROCUREMENT_ORDERS_PAGE),
  procurementRoute('admin', 'Regole & Analisi', PROCUREMENT_ADMIN_PAGE),
];
