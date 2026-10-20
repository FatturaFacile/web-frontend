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
];
