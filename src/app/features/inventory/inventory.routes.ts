import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'stock',
  },
  {
    path: 'stock',
    data: { breadcrumb: 'Giacenze & Articoli', title: 'Giacenze' },
    loadComponent: () =>
      import('./inventory.component').then((m) => m.InventoryComponent),
  },
  {
    path: 'ddt',
    data: { breadcrumb: 'DDT & Trasporti', title: 'DDT' },
    loadComponent: () =>
      import('./inventory.component').then((m) => m.InventoryComponent),
  },
  {
    path: 'customs',
    data: { breadcrumb: 'Dogana IT-CH', title: 'Dogana IT-CH' },
    loadComponent: () =>
      import('./inventory.component').then((m) => m.InventoryComponent),
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
