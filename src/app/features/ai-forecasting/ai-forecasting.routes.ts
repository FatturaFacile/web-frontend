import { Routes } from '@angular/router';

export const AI_FORECASTING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ai-forecasting-shell.component').then((m) => m.AiForecastingShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'liquidity' },
      {
        path: 'liquidity',
        data: { breadcrumb: 'AI_FORECAST.TAB_LIQUIDITY', title: 'AI_FORECAST.TITLE' },
        loadComponent: () =>
          import('./liquidity-forecast.component').then((m) => m.LiquidityForecastComponent),
      },
      {
        path: 'demand',
        data: { breadcrumb: 'AI_FORECAST.TAB_DEMAND', title: 'AI_FORECAST.TITLE' },
        loadComponent: () =>
          import('./demand-forecast.component').then((m) => m.DemandForecastComponent),
      },
    ],
  },
];
