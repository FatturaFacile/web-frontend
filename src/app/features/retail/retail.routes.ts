import { Routes } from '@angular/router';

export const RETAIL_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Vendita al Banco & POS', title: 'Vendita al Banco' },
    loadComponent: () =>
      import('./retail.component').then((m) => m.RetailComponent),
  },
];
