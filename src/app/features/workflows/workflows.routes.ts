import { Routes } from '@angular/router';
import { WORKFLOW_DESIGN_PAGE } from './workflow-design.page';

export const WORKFLOW_ROUTES: Routes = [
  {
    path: 'designer',
    data: { breadcrumb: 'RES.PAGE.WORKFLOW_DESIGN', title: 'RES.PAGE.WORKFLOW_DESIGN', page: WORKFLOW_DESIGN_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'inbox',
    data: { breadcrumb: 'workflows.inbox.title', title: 'workflows.inbox.title' },
    loadComponent: () => import('./approval-inbox.page').then((m) => m.ApprovalInboxPageComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./workflows.component').then((m) => m.WorkflowsComponent),
  },
];
