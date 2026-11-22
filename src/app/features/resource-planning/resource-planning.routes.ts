import { Routes } from '@angular/router';

export const RESOURCE_PLANNING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.RESOURCE_PLANNING_PLANNER',
      title: 'PAGE_TITLE.RESOURCE_PLANNING',
    },
    loadComponent: () =>
      import('./resource-planner.component').then((m) => m.ResourcePlannerComponent),
  },
  {
    path: 'utilization',
    data: {
      breadcrumb: 'NAV.RESOURCE_PLANNING_UTILIZATION',
      title: 'PAGE_TITLE.RESOURCE_PLANNING_UTILIZATION',
    },
    loadComponent: () => import('./utilization.component').then((m) => m.UtilizationComponent),
  },
  {
    path: 'skills',
    data: {
      breadcrumb: 'NAV.RESOURCE_PLANNING_SKILLS',
      title: 'PAGE_TITLE.RESOURCE_PLANNING_SKILLS',
    },
    loadComponent: () => import('./skill-matrix.component').then((m) => m.SkillMatrixComponent),
  },
];
