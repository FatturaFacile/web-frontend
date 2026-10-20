import { Routes } from '@angular/router';

export const TREASURY_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Tesoreria & Banche', title: 'Tesoreria & Banche' },
    loadComponent: () =>
      import('./treasury.component').then((m) => m.TreasuryComponent),
  },
];
