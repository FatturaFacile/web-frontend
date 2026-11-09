import { Routes } from '@angular/router';

export const PORTAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
  {
    path: ':token',
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
];
