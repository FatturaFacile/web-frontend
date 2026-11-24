import { Routes } from '@angular/router';

/** Accounts, activities, segments, campaigns, lead scoring and reports, mounted under `/crm/engagement`. */
export const ENGAGEMENT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'activities' },
  {
    path: 'activities',
    data: { breadcrumb: 'BREADCRUMB.ATTIVITA', title: 'PAGE_TITLE.ATTIVITA_CRM' },
    loadComponent: () => import('./activities/activities.component').then((m) => m.ActivitiesComponent),
  },
  {
    path: 'accounts',
    data: { breadcrumb: 'BREADCRUMB.ACCOUNT', title: 'PAGE_TITLE.ACCOUNT_CRM' },
    loadComponent: () => import('./accounts/accounts.component').then((m) => m.AccountsComponent),
  },
  {
    path: 'segments',
    data: { breadcrumb: 'BREADCRUMB.SEGMENTI', title: 'PAGE_TITLE.SEGMENTI' },
    loadComponent: () => import('./segments/segments.component').then((m) => m.SegmentsComponent),
  },
  {
    path: 'campaigns',
    data: { breadcrumb: 'BREADCRUMB.CAMPAGNE', title: 'PAGE_TITLE.CAMPAGNE' },
    loadComponent: () => import('./campaigns/campaigns.component').then((m) => m.CampaignsComponent),
  },
  {
    path: 'scoring',
    data: { breadcrumb: 'BREADCRUMB.REGOLE_DI_SCORING', title: 'PAGE_TITLE.REGOLE_DI_SCORING' },
    loadComponent: () => import('./scoring/scoring-rules.component').then((m) => m.ScoringRulesComponent),
  },
  {
    path: 'reports',
    data: { breadcrumb: 'BREADCRUMB.REPORT_E_PREVISIONI', title: 'PAGE_TITLE.REPORT_E_PREVISIONI_CRM' },
    loadComponent: () => import('./reports/crm-reports.component').then((m) => m.CrmReportsComponent),
  },
];
