import { Routes } from '@angular/router';

export const RENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'fleet',
  },
  {
    path: 'fleet',
    data: { breadcrumb: 'Planning Flotta', title: 'Flotta Noleggio' },
    loadComponent: () =>
      import('./rent.component').then((m) => m.RentComponent),
  },
  {
    path: 'appraisal',
    data: { breadcrumb: 'Perizia Danni', title: 'Perizia Danni' },
    loadComponent: () =>
      import('./rent.component').then((m) => m.RentComponent),
  },
];
