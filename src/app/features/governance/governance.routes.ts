import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { SOD_RULES_PAGE } from './sod-rules.page';

export const GOVERNANCE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'risks',
  },
  {
    path: 'risks',
    data: { breadcrumb: 'NAV.GOVERNANCE_RISKS', title: 'PAGE_TITLE.GOVERNANCE_RISKS' },
    loadComponent: () => import('./risks.component').then((m) => m.GovernanceRisksComponent),
  },
  {
    path: 'controls',
    data: { breadcrumb: 'NAV.GOVERNANCE_CONTROLS', title: 'PAGE_TITLE.GOVERNANCE_CONTROLS' },
    loadComponent: () => import('./controls.component').then((m) => m.GovernanceControlsComponent),
  },
  {
    path: 'audits',
    data: { breadcrumb: 'NAV.GOVERNANCE_AUDITS', title: 'PAGE_TITLE.GOVERNANCE_AUDITS' },
    loadComponent: () => import('./audits.component').then((m) => m.GovernanceAuditsComponent),
  },
  {
    path: 'findings',
    data: { breadcrumb: 'NAV.GOVERNANCE_FINDINGS', title: 'PAGE_TITLE.GOVERNANCE_FINDINGS' },
    loadComponent: () => import('./findings.component').then((m) => m.GovernanceFindingsComponent),
  },
  {
    path: 'actions',
    data: { breadcrumb: 'NAV.GOVERNANCE_ACTIONS', title: 'PAGE_TITLE.GOVERNANCE_ACTIONS' },
    loadComponent: () => import('./actions.component').then((m) => m.GovernanceActionsComponent),
  },
  {
    path: 'obligations',
    data: { breadcrumb: 'NAV.GOVERNANCE_OBLIGATIONS', title: 'PAGE_TITLE.GOVERNANCE_OBLIGATIONS' },
    loadComponent: () => import('./obligations.component').then((m) => m.GovernanceObligationsComponent),
  },
  {
    path: 'segregation-of-duties',
    data: { breadcrumb: 'NAV.GOVERNANCE_SOD', title: 'PAGE_TITLE.GOVERNANCE_SOD' },
    loadComponent: () => import('./segregation-of-duties.component').then((m) => m.GovernanceSegregationOfDutiesComponent),
  },
  {
    path: 'document-rules',
    data: { breadcrumb: 'RES.PAGE.SOD_DOCUMENT_RULES', title: 'RES.PAGE.SOD_DOCUMENT_RULES', page: SOD_RULES_PAGE },
    component: ResourcePageComponent,
  },
];
