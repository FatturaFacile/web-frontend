import { Routes } from '@angular/router';

export const BUDGETING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.BUDGETING_DASHBOARD', title: 'PAGE_TITLE.BUDGETING_DASHBOARD' },
    loadComponent: () => import('./budgeting-dashboard.component').then((m) => m.BudgetingDashboardComponent),
  },
  {
    path: 'versions',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.BUDGETING_VERSIONS', title: 'PAGE_TITLE.BUDGETING_VERSIONS' },
    loadComponent: () => import('./budgeting-versions.component').then((m) => m.BudgetingVersionsComponent),
  },
  {
    path: 'spend-control',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.BUDGETING_SPEND_CONTROL', title: 'PAGE_TITLE.BUDGETING_SPEND_CONTROL' },
    loadComponent: () => import('./budgeting-spend-control.component').then((m) => m.BudgetingSpendControlComponent),
  },
  {
    path: 'overrides',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.BUDGETING_OVERRIDES', title: 'PAGE_TITLE.BUDGETING_OVERRIDES' },
    loadComponent: () => import('./budgeting-overrides.component').then((m) => m.BudgetingOverridesComponent),
  },
  {
    path: 'versions/:id',
    data: { breadcrumb: 'NAV.BUDGETING_VERSION', title: 'PAGE_TITLE.BUDGETING_VERSION' },
    loadComponent: () => import('./budgeting-version-detail.component').then((m) => m.BudgetingVersionDetailComponent),
  },
];
