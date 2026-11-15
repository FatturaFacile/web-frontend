import { Routes } from '@angular/router';

export const CREDIT_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.CREDIT_DASHBOARD', title: 'PAGE_TITLE.CREDIT_DASHBOARD' },
    loadComponent: () => import('./credit-dashboard.component').then((m) => m.CreditDashboardComponent),
  },
  {
    path: 'worklist',
    data: { breadcrumb: 'NAV.CREDIT_WORKLIST', title: 'PAGE_TITLE.CREDIT_WORKLIST' },
    loadComponent: () => import('./credit-worklist.component').then((m) => m.CreditWorklistComponent),
  },
  {
    path: 'cases',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.CREDIT_CASES', title: 'PAGE_TITLE.CREDIT_CASES' },
    loadComponent: () => import('./credit-cases.component').then((m) => m.CreditCasesComponent),
  },
  {
    path: 'cases/:id',
    data: { breadcrumb: 'NAV.CREDIT_CASE', title: 'PAGE_TITLE.CREDIT_CASE' },
    loadComponent: () => import('./credit-case-detail.component').then((m) => m.CreditCaseDetailComponent),
  },
  {
    path: 'scores',
    data: { breadcrumb: 'NAV.CREDIT_SCORES', title: 'PAGE_TITLE.CREDIT_SCORES' },
    loadComponent: () => import('./credit-scores.component').then((m) => m.CreditScoresComponent),
  },
  {
    path: 'scorecard',
    data: { breadcrumb: 'NAV.CREDIT_SCORECARD', title: 'PAGE_TITLE.CREDIT_SCORECARD' },
    loadComponent: () => import('./credit-scorecard.component').then((m) => m.CreditScorecardComponent),
  },
  {
    path: 'exposures',
    data: { breadcrumb: 'NAV.CREDIT_EXPOSURES', title: 'PAGE_TITLE.CREDIT_EXPOSURES' },
    loadComponent: () => import('./credit-exposures.component').then((m) => m.CreditExposuresComponent),
  },
  {
    path: 'limit-requests',
    data: { breadcrumb: 'NAV.CREDIT_LIMITS', title: 'PAGE_TITLE.CREDIT_LIMITS' },
    loadComponent: () => import('./credit-limits.component').then((m) => m.CreditLimitsComponent),
  },
  {
    path: 'insurance',
    data: { breadcrumb: 'NAV.CREDIT_INSURANCE', title: 'PAGE_TITLE.CREDIT_INSURANCE' },
    loadComponent: () => import('./credit-insurance.component').then((m) => m.CreditInsuranceComponent),
  },
  {
    path: 'strategies',
    data: { breadcrumb: 'NAV.CREDIT_STRATEGIES', title: 'PAGE_TITLE.CREDIT_STRATEGIES' },
    loadComponent: () => import('./credit-strategies.component').then((m) => m.CreditStrategiesComponent),
  },
];
