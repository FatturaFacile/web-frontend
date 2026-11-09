import { Routes } from '@angular/router';

export const CUSTOMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./customs.component').then((m) => m.CustomsComponent),
  },
];
