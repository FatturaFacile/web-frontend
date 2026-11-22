import { Routes } from '@angular/router';
import { AnalyticalAccountingStore } from './analytical-accounting.store';

export const ANALYTICAL_ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    providers: [AnalyticalAccountingStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { breadcrumb: 'NAV.ANALYTICAL_CENTERS', title: 'PAGE_TITLE.ANALYTICAL_CENTERS' },
        loadComponent: () => import('./analytical-centers.component').then((m) => m.AnalyticalCentersComponent),
      },
      {
        path: 'rules',
        data: { breadcrumb: 'NAV.ANALYTICAL_RULES', title: 'PAGE_TITLE.ANALYTICAL_RULES' },
        loadComponent: () => import('./analytical-rules.component').then((m) => m.AnalyticalRulesComponent),
      },
      {
        path: 'apportionment',
        data: { breadcrumb: 'NAV.ANALYTICAL_APPORTIONMENT', title: 'PAGE_TITLE.ANALYTICAL_APPORTIONMENT' },
        loadComponent: () => import('./analytical-apportionment.component').then((m) => m.AnalyticalApportionmentComponent),
      },
      {
        path: 'reports',
        data: { breadcrumb: 'NAV.ANALYTICAL_REPORTS', title: 'PAGE_TITLE.ANALYTICAL_REPORTS' },
        loadComponent: () => import('./analytical-reports.component').then((m) => m.AnalyticalReportsComponent),
      },
    ],
  },
];
