import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { LOTS_PAGE, STOCK_REPORTS_PAGE } from './wms/lots-reports.page';
import { INVENTORY_SERVICES_PAGE, STOCK_ITEMS_PAGE } from './wms/items-service.page';
import { OUTBOUND_PAGE } from './wms/outbound.page';
import { COUNTING_PAGE, REPLENISHMENT_PAGE, TRANSFERS_PAGE } from './wms/stock-flows.page';
import { TERMINAL_PAGE } from './wms/terminal-service.page';
import { WAREHOUSE_PAGE } from './wms/warehouse.page';

const wmsRoute = (path: string, breadcrumb: string, page: object) => ({
  path,
  data: { breadcrumb, title: breadcrumb, page },
  component: ResourcePageComponent,
});

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'stock',
  },
  {
    path: 'stock',
    data: { breadcrumb: 'BREADCRUMB.GIACENZE_AND_ARTICOLI', title: 'Giacenze' },
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
    data: { breadcrumb: 'BREADCRUMB.DOGANA_IT_CH', title: 'Dogana IT-CH' },
    loadChildren: () =>
      import('../customs/customs.routes').then((m) => m.CUSTOMS_ROUTES),
  },
];
