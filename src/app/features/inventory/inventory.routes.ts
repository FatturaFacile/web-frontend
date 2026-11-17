import { Routes } from '@angular/router';
import { LOTS_PAGE, STOCK_REPORTS_PAGE } from './wms/lots-reports.page';
import { INVENTORY_SERVICES_PAGE, STOCK_ITEMS_PAGE } from './wms/items-service.page';
import { OUTBOUND_PAGE } from './wms/outbound.page';
import { COUNTING_PAGE, REPLENISHMENT_PAGE, TRANSFERS_PAGE } from './wms/stock-flows.page';
import { TERMINAL_PAGE } from './wms/terminal-service.page';
import { WAREHOUSE_PAGE } from './wms/warehouse.page';

const wmsRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  data: { breadcrumb, title: breadcrumb, page },
  loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
});

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'stock',
  },
  {
    path: 'stock',
    data: { breadcrumb: 'BREADCRUMB.GIACENZE_AND_ARTICOLI', title: 'PAGE_TITLE.GIACENZE' },
    loadComponent: () =>
      import('./inventory.component').then((m) => m.InventoryComponent),
  },
  {
    path: 'ddt',
    data: { breadcrumb: 'BREADCRUMB.DDT_AND_TRASPORTI', title: 'DDT' },
    loadComponent: () =>
      import('./inventory.component').then((m) => m.InventoryComponent),
  },
  wmsRoute('warehouse', 'Struttura & Putaway', WAREHOUSE_PAGE),
  wmsRoute('outbound', 'Uscite & Spedizioni', OUTBOUND_PAGE),
  wmsRoute('transfers', 'Trasferimenti', TRANSFERS_PAGE),
  wmsRoute('counting', 'Inventari ciclici', COUNTING_PAGE),
  wmsRoute('replenishment', 'Riordino', REPLENISHMENT_PAGE),
  wmsRoute('lots', 'Lotti & Richiami', LOTS_PAGE),
  wmsRoute('items', 'Anagrafica articoli', STOCK_ITEMS_PAGE),
  wmsRoute('reports', 'Valorizzazione & KPI', STOCK_REPORTS_PAGE),
  wmsRoute('terminal', 'Terminale & Barcode', TERMINAL_PAGE),
  wmsRoute('services', 'Assistenza & Pesa', INVENTORY_SERVICES_PAGE),
  {
    path: 'customs',
    data: { breadcrumb: 'BREADCRUMB.DOGANA_IT_CH', title: 'PAGE_TITLE.DOGANA_IT_CH' },
    loadChildren: () =>
      import('../customs/customs.routes').then((m) => m.CUSTOMS_ROUTES),
  },
  {
    path: 'valuation',
    data: { breadcrumb: 'Valorizzazione', title: 'Valorizzazione magazzino' },
    loadComponent: () =>
      import('./valuation/valuation-config.component').then((m) => m.ValuationConfigComponent),
  },
  {
    path: 'cost-layers',
    data: { breadcrumb: 'Strati di costo', title: 'Strati di costo' },
    loadComponent: () =>
      import('./cost-layers/cost-layers.component').then((m) => m.CostLayersComponent),
  },
  {
    path: 'landed-costs',
    data: { breadcrumb: 'Costi accessori', title: 'Costi accessori' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./landed-costs/landed-cost-list.component').then((m) => m.LandedCostListComponent),
      },
      {
        path: 'new',
        data: { breadcrumb: 'Nuovo', title: 'Nuovo costo accessorio' },
        loadComponent: () =>
          import('./landed-costs/landed-cost-form.component').then((m) => m.LandedCostFormComponent),
      },
      {
        path: ':id',
        data: { breadcrumb: 'Dettaglio', title: 'Costo accessorio' },
        loadComponent: () =>
          import('./landed-costs/landed-cost-detail.component').then((m) => m.LandedCostDetailComponent),
      },
    ],
  },
  {
    path: 'book',
    data: { breadcrumb: 'Libro inventari', title: 'Libro inventari' },
    loadComponent: () =>
      import('./book/inventory-book.component').then((m) => m.InventoryBookComponent),
  },
];
