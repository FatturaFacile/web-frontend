import { Routes } from '@angular/router';

export const SHIFT_PLANNING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.SHIFT_PLANNING_ROSTER', title: 'PAGE_TITLE.SHIFT_PLANNING' },
    loadComponent: () => import('./roster-matrix.component').then((m) => m.RosterMatrixComponent),
  },
  {
    path: 'templates',
    data: { breadcrumb: 'NAV.SHIFT_PLANNING_TEMPLATES', title: 'PAGE_TITLE.SHIFT_TEMPLATES' },
    loadComponent: () =>
      import('./shift-templates.component').then((m) => m.ShiftTemplatesComponent),
  },
];
