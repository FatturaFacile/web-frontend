import { Routes } from '@angular/router';

export const VISITORS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./visitors.component').then((m) => m.VisitorsComponent),
  },
];
