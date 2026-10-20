import { Routes } from '@angular/router';

export const MANUFACTURING_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Produzione & MRP', title: 'Produzione & MRP' },
    loadComponent: () =>
      import('./manufacturing.component').then((m) => m.ManufacturingComponent),
  },
];
