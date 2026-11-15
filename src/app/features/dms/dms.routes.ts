import { Routes } from '@angular/router';

export const DMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dms.component').then((m) => m.DmsComponent),
  },
  {
    path: 'workflows',
    loadComponent: () =>
      import('./dms-workflows.component').then((m) => m.DmsWorkflowsComponent),
  },
];
