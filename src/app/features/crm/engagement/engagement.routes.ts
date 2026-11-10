import { Routes } from '@angular/router';

/** Accounts, activities, segments, campaigns, lead scoring and reports, mounted under `/crm/engagement`. */
export const ENGAGEMENT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'activities' },
  {
    path: 'activities',
    data: { breadcrumb: 'BREADCRUMB.ATTIVITA', title: 'Attività CRM' },
    loadComponent: () => import('./activities/activities.component').then((m) => m.ActivitiesComponent),
  },
  {
    path: 'accounts',
    data: { breadcrumb: 'BREADCRUMB.ACCOUNT', title: 'Account CRM' },
    loadComponent: () => import('./accounts/accounts.component').then((m) => m.AccountsComponent),
  },
  {
    path: 'segments',
    data: { breadcrumb: 'BREADCRUMB.SEGMENTI', title: 'Segmenti' },
    loadComponent: () => import('./segments/segments.component').then((m) => m.SegmentsComponent),
  },
  {
    path: 'campaigns',
    data: { breadcrumb: 'BREADCRUMB.CAMPAGNE', title: 'Campagne' },
    loadComponent: () => import('./campaigns/campaigns.component').then((m) => m.CampaignsComponent),
  },
  {
    path: 'scoring',
    data: { breadcrumb: 'BREADCRUMB.REGOLE_DI_SCORING', title: 'Regole di scoring' },
    loadComponent: () => import('./scoring/scoring-rules.component').then((m) => m.ScoringRulesComponent),
  },
  {
    path: 'reports',
    data: { breadcrumb: 'BREADCRUMB.REPORT_E_PREVISIONI', title: 'Report e previsioni CRM' },
    loadComponent: () => import('./reports/crm-reports.component').then((m) => m.CrmReportsComponent),
  },
];
