import { Routes } from '@angular/router';

export const PLANNING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.PLANNING_DASHBOARD', title: 'PAGE_TITLE.PLANNING_DASHBOARD' },
    loadComponent: () => import('./planning-dashboard.component').then((m) => m.PlanningDashboardComponent),
  },
  {
    path: 'scenarios',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.PLANNING_SCENARIOS', title: 'PAGE_TITLE.PLANNING_SCENARIOS' },
    loadComponent: () => import('./planning-scenarios.component').then((m) => m.PlanningScenariosComponent),
  },
  {
    path: 'scenarios/:id',
    data: { breadcrumb: 'NAV.PLANNING_SCENARIO', title: 'PAGE_TITLE.PLANNING_SCENARIO' },
    loadComponent: () => import('./planning-scenario-detail.component').then((m) => m.PlanningScenarioDetailComponent),
  },
  {
    path: 'compare',
    data: { breadcrumb: 'NAV.PLANNING_COMPARE', title: 'PAGE_TITLE.PLANNING_COMPARE' },
    loadComponent: () => import('./planning-compare.component').then((m) => m.PlanningCompareComponent),
  },
  {
    path: 'resources',
    data: { breadcrumb: 'NAV.PLANNING_RESOURCES', title: 'PAGE_TITLE.PLANNING_RESOURCES' },
    loadComponent: () => import('./planning-resources.component').then((m) => m.PlanningResourcesComponent),
  },
];
