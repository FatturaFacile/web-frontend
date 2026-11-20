import { Routes } from '@angular/router';

export const ACADEMY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'ACADEMY.TITLE', title: 'ACADEMY.TITLE' },
    loadComponent: () => import('./academy-hub.page').then((m) => m.AcademyHubPageComponent),
  },
  {
    path: 'classroom',
    data: { breadcrumb: 'ACADEMY.CLASSROOM', title: 'ACADEMY.CLASSROOM' },
    loadComponent: () =>
      import('./classroom-dashboard.component').then((m) => m.ClassroomDashboardComponent),
  },
  {
    path: 'classroom/:id',
    data: { breadcrumb: 'ACADEMY.CLASSROOM', title: 'ACADEMY.CLASSROOM' },
    loadComponent: () =>
      import('./classroom-dashboard.component').then((m) => m.ClassroomDashboardComponent),
  },
];
