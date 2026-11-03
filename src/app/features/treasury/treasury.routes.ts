import { Routes } from '@angular/router';

export const TREASURY_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'NAV.TREASURY', title: 'NAV.TREASURY' },
    loadComponent: () =>
      import('./treasury.component').then((m) => m.TreasuryComponent),
  },
];
