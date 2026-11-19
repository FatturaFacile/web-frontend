import { Routes } from '@angular/router';

export const CONTROLLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./controlling-shell.component').then((m) => m.ControllingShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'margins' },
      {
        path: 'margins',
        data: { breadcrumb: 'NAV.CONTROLLING_MARGINS', title: 'PAGE_TITLE.CONTROLLING_MARGINS' },
        loadComponent: () => import('./controlling-margins.component').then((m) => m.ControllingMarginsComponent),
      },
      {
        path: 'working-capital',
        data: { breadcrumb: 'NAV.CONTROLLING_WORKING_CAPITAL', title: 'PAGE_TITLE.CONTROLLING_WORKING_CAPITAL' },
        loadComponent: () => import('./controlling-working-capital.component').then((m) => m.ControllingWorkingCapitalComponent),
      },
      {
        path: 'cost-centers',
        data: { breadcrumb: 'NAV.CONTROLLING_COST_CENTERS', title: 'PAGE_TITLE.CONTROLLING_COST_CENTERS' },
        loadComponent: () => import('./controlling-cost-centers.component').then((m) => m.ControllingCostCentersComponent),
      },
      {
        path: 'variance',
        data: { breadcrumb: 'NAV.CONTROLLING_VARIANCE', title: 'PAGE_TITLE.CONTROLLING_VARIANCE' },
        loadComponent: () => import('./controlling-variance.component').then((m) => m.ControllingVarianceComponent),
      },
      {
        path: 'budgets',
        data: { breadcrumb: 'NAV.CONTROLLING_BUDGETS', title: 'PAGE_TITLE.CONTROLLING_BUDGETS' },
        loadComponent: () => import('./controlling-budgets.component').then((m) => m.ControllingBudgetsComponent),
      },
    ],
  },
];
