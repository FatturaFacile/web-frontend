import { Routes } from '@angular/router';
import { PROJECT_PLANNING_PAGE } from './control/pc-tools.page';

export const PROJECTS_ROUTES: Routes = [
  {
    path: 'planning',
    data: { breadcrumb: 'RES.PAGE.PROJECT_PLANNING', title: 'RES.PAGE.PROJECT_PLANNING', page: PROJECT_PLANNING_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'wip',
    data: { breadcrumb: 'PROJECT_BILLING.WIP_TITLE', title: 'PROJECT_BILLING.WIP_TITLE' },
    loadComponent: () => import('./billing/wip-valuation.component').then((m) => m.WipValuationComponent),
  },
  {
    path: ':id/billing',
    data: { breadcrumb: 'PROJECT_BILLING.NAV', title: 'PROJECT_BILLING.TITLE' },
    loadComponent: () => import('./billing/project-billing.component').then((m) => m.ProjectBillingComponent),
  },
  {
    path: ':id/evm',
    data: { breadcrumb: 'PROJECT_EVM.NAV', title: 'PROJECT_EVM.TITLE' },
    loadComponent: () =>
      import('./evm/project-evm-dashboard.component').then((m) => m.ProjectEvmDashboardComponent),
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
