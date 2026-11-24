import { Routes } from '@angular/router';
import { MarketingAutomationStore } from './marketing-automation.store';

export const MARKETING_AUTOMATION_ROUTES: Routes = [
  {
    path: '',
    providers: [MarketingAutomationStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        data: { breadcrumb: 'NAV.MARKETING_DASHBOARD', title: 'PAGE_TITLE.MARKETING_AUTOMATION' },
        loadComponent: () =>
          import('./marketing-dashboard.component').then((m) => m.MarketingDashboardComponent),
      },
      {
        path: 'segments',
        data: { breadcrumb: 'NAV.MARKETING_SEGMENTS', title: 'PAGE_TITLE.MARKETING_AUTOMATION' },
        loadComponent: () => import('./rfm-segments.component').then((m) => m.RfmSegmentsComponent),
      },
      {
        path: 'campaigns',
        data: { breadcrumb: 'NAV.MARKETING_CAMPAIGNS', title: 'PAGE_TITLE.MARKETING_AUTOMATION' },
        loadComponent: () =>
          import('./marketing-campaigns.component').then((m) => m.MarketingCampaignsComponent),
      },
      {
        path: 'designer',
        data: { breadcrumb: 'NAV.MARKETING_DESIGNER', title: 'PAGE_TITLE.MARKETING_AUTOMATION' },
        loadComponent: () =>
          import('./email-designer.component').then((m) => m.EmailDesignerComponent),
      },
      {
        path: 'journey',
        data: { breadcrumb: 'NAV.MARKETING_JOURNEY', title: 'PAGE_TITLE.MARKETING_AUTOMATION' },
        loadComponent: () =>
          import('./journey-builder.component').then((m) => m.JourneyBuilderComponent),
      },
      {
        path: 'consent',
        data: { breadcrumb: 'NAV.MARKETING_CONSENT', title: 'PAGE_TITLE.MARKETING_AUTOMATION' },
        loadComponent: () =>
          import('./consent-compliance.component').then((m) => m.ConsentComplianceComponent),
      },
    ],
  },
];
