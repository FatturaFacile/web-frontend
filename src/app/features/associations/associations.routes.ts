import { Routes } from '@angular/router';

export const ASSOCIATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./associations.component').then((m) => m.AssociationsComponent),
  },
];
