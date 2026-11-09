import { Routes } from '@angular/router';

export const DMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dms.component').then((m) => m.DmsComponent),
  },
];
