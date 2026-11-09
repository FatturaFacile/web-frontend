import { Routes } from '@angular/router';

export const INTRASTAT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./intrastat.component').then((m) => m.IntrastatComponent),
  },
];
