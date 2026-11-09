import { Routes } from '@angular/router';

export const TREASURY_ROUTES: Routes = [
  {
    path: 'operations',
    data: { breadcrumb: 'NAV.TREASURY_OPERATIONS', title: 'NAV.TREASURY_OPERATIONS' },
    loadChildren: () =>
      import('./operations/treasury-operations.routes').then((m) => m.TREASURY_OPERATIONS_ROUTES),
  },
  {
    path: '',
    data: { breadcrumb: 'NAV.TREASURY', title: 'NAV.TREASURY' },
    loadComponent: () =>
      import('./treasury.component').then((m) => m.TreasuryComponent),
  },
];
