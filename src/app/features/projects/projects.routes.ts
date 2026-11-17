import { Routes } from '@angular/router';
import { PROJECT_PLANNING_PAGE } from './control/pc-tools.page';

export const PROJECTS_ROUTES: Routes = [
  {
    path: 'planning',
    data: { breadcrumb: 'RES.PAGE.PROJECT_PLANNING', title: 'RES.PAGE.PROJECT_PLANNING', page: PROJECT_PLANNING_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
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
