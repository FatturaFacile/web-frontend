import { Routes } from '@angular/router';

export const FIDUCIARY_PORTAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./fiduciary-portal.component').then((m) => m.FiduciaryPortalComponent),
  },
];
