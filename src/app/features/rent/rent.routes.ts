import { Routes } from '@angular/router';

export const RENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'fleet',
  },
  {
    path: 'fleet',
    data: { breadcrumb: 'BREADCRUMB.PLANNING_FLOTTA', title: 'PAGE_TITLE.FLOTTA_NOLEGGIO' },
    loadComponent: () =>
      import('./rent.component').then((m) => m.RentComponent),
  },
  {
    path: 'appraisal',
    data: { breadcrumb: 'BREADCRUMB.PERIZIA_DANNI', title: 'PAGE_TITLE.PERIZIA_DANNI' },
    loadComponent: () =>
      import('./rent.component').then((m) => m.RentComponent),
  },
];
