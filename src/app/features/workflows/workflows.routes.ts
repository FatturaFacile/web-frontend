import { Routes } from '@angular/router';

export const WORKFLOW_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./workflows.component').then((m) => m.WorkflowsComponent),
  },
];
