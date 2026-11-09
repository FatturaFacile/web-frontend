import { Routes } from '@angular/router';

export const PROJECTS_ROUTES: Routes = [
  {
    path: ':id/control',
    data: { breadcrumb: 'PRJ.CONTROL_TITLE', title: 'PRJ.CONTROL_TITLE' },
    loadComponent: () =>
      import('./control/project-control.component').then((m) => m.ProjectControlComponent),
  },
  {
    path: '',
    loadComponent: () => import('./projects.component').then((m) => m.ProjectsComponent),
  },
];
