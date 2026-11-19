import { Routes } from '@angular/router';
import { WORKFLOW_DESIGN_PAGE } from './workflow-design.page';

export const WORKFLOW_ROUTES: Routes = [
  {
    path: 'designer',
    data: { breadcrumb: 'RES.PAGE.WORKFLOW_DESIGN', title: 'RES.PAGE.WORKFLOW_DESIGN', page: WORKFLOW_DESIGN_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./workflows.component').then((m) => m.WorkflowsComponent),
  },
];
