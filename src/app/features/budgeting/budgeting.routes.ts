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
    path: 'versions/:id',
    data: { breadcrumb: 'NAV.BUDGETING_VERSION', title: 'PAGE_TITLE.BUDGETING_VERSION' },
    loadComponent: () => import('./budgeting-version-detail.component').then((m) => m.BudgetingVersionDetailComponent),
  },
];
