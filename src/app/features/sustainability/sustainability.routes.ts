import { Routes } from '@angular/router';

export const SUSTAINABILITY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.SUSTAINABILITY_INVENTORY', title: 'PAGE_TITLE.SUSTAINABILITY_INVENTORY' },
    loadComponent: () =>
      import('./sustainability-dashboard.component').then((m) => m.SustainabilityDashboardComponent),
  },
  {
    path: 'activity',
    data: { breadcrumb: 'NAV.SUSTAINABILITY_ACTIVITY', title: 'PAGE_TITLE.SUSTAINABILITY_ACTIVITY' },
    loadComponent: () =>
      import('./sustainability-activity.component').then((m) => m.SustainabilityActivityComponent),
  },
  {
    path: 'factors',
    data: { breadcrumb: 'NAV.SUSTAINABILITY_FACTORS', title: 'PAGE_TITLE.SUSTAINABILITY_FACTORS' },
    loadComponent: () =>
      import('./sustainability-factors.component').then((m) => m.SustainabilityFactorsComponent),
  },
  {
    path: 'targets',
    data: { breadcrumb: 'NAV.SUSTAINABILITY_TARGETS', title: 'PAGE_TITLE.SUSTAINABILITY_TARGETS' },
    loadComponent: () =>
      import('./sustainability-targets.component').then((m) => m.SustainabilityTargetsComponent),
  },
  {
    path: 'kpis',
    data: { breadcrumb: 'NAV.SUSTAINABILITY_KPIS', title: 'PAGE_TITLE.SUSTAINABILITY_KPIS' },
    loadComponent: () =>
      import('./sustainability-kpis.component').then((m) => m.SustainabilityKpisComponent),
  },
  {
    path: 'materiality',
    data: { breadcrumb: 'NAV.SUSTAINABILITY_MATERIALITY', title: 'PAGE_TITLE.SUSTAINABILITY_MATERIALITY' },
    loadComponent: () =>
      import('./sustainability-materiality.component').then((m) => m.SustainabilityMaterialityComponent),
  },
];
