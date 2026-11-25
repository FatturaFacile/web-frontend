import { Routes } from '@angular/router';
import { LiquidityPlanningStore } from './liquidity-planning.store';

/** The workspace and the report share one store, so the report prints the what-if on screen. */
export const LIQUIDITY_PLANNING_ROUTES: Routes = [
  {
    path: '',
    providers: [LiquidityPlanningStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { breadcrumb: 'NAV.LIQUIDITY_PLANNING', title: 'PAGE_TITLE.LIQUIDITY_PLANNING' },
        loadComponent: () =>
          import('./liquidity-planning.component').then((m) => m.LiquidityPlanningComponent),
      },
      {
        path: 'report',
        data: {
          breadcrumb: 'NAV.LIQUIDITY_PLANNING_REPORT',
          title: 'PAGE_TITLE.LIQUIDITY_PLANNING_REPORT',
        },
        loadComponent: () => import('./lp-report.component').then((m) => m.LpReportComponent),
      },
    ],
  },
];
