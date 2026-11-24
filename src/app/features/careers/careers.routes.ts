import { Routes } from '@angular/router';

/** Public, unauthenticated careers portal (`/careers/:slug`). */
export const CAREERS_ROUTES: Routes = [
  {
    path: ':slug',
    loadComponent: () => import('./careers-home.component').then((m) => m.CareersHomeComponent),
  },
  {
    path: ':slug/jobs/:id',
    loadComponent: () => import('./careers-job.component').then((m) => m.CareersJobComponent),
  },
];
