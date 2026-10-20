import { Routes } from '@angular/router';

export const CONSTRUCTION_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Cantieri & Impianti', title: 'Cantieri & Impianti' },
    loadComponent: () =>
      import('./construction.component').then((m) => m.ConstructionComponent),
  },
];
