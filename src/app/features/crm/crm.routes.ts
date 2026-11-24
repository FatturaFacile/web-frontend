import { Routes } from '@angular/router';
import { CRM_PRM_CONFIG_PAGE } from './prm-config.page';
import { TERRITORY_ACCOUNTS_PAGE } from './territory-accounts.page';

export const CRM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'clients',
  },
  {
    path: 'clients',
    data: { breadcrumb: 'BREADCRUMB.CLIENTI_CROSS_BORDER', title: 'PAGE_TITLE.ANAGRAFICA_CLIENTI' },
    loadComponent: () => import('./clients/clients.component').then((m) => m.CrmClientsComponent),
  },
  {
    path: 'clients/:id',
    data: { breadcrumb: 'CRM.CUSTOMER360.TITLE', title: 'CRM.CUSTOMER360.TITLE' },
    loadComponent: () =>
      import('./clients/customer-360.component').then((m) => m.Customer360Component),
  },
  {
    path: 'suppliers',
    data: { breadcrumb: 'BREADCRUMB.FORNITORI_AND_LISTINI', title: 'PAGE_TITLE.FORNITORI_LISTINI' },
    loadComponent: () => import('./clients/clients.component').then((m) => m.CrmClientsComponent),
  },
  {
    path: 'leads',
    data: { breadcrumb: 'NAV.LEADS', title: 'NAV.LEADS' },
    loadComponent: () => import('./leads/leads.component').then((m) => m.LeadsComponent),
  },
  {
    path: 'leads/duplicates',
    data: { breadcrumb: 'NAV.LEAD_DUPLICATES', title: 'NAV.LEAD_DUPLICATES' },
    loadComponent: () =>
      import('./leads/lead-duplicates.component').then((m) => m.LeadDuplicatesComponent),
  },
  {
    path: 'leads/:id',
    data: { breadcrumb: 'NAV.LEAD_DETAIL', title: 'NAV.LEAD_DETAIL' },
    loadComponent: () => import('./leads/lead-detail.component').then((m) => m.LeadDetailComponent),
  },
  {
    path: 'lead-sources',
    data: { breadcrumb: 'NAV.LEAD_SOURCES', title: 'NAV.LEAD_SOURCES' },
    loadComponent: () =>
      import('./lead-admin/lead-sources.component').then((m) => m.LeadSourcesComponent),
  },
  {
    path: 'lead-scoring',
    data: { breadcrumb: 'NAV.LEAD_SCORING', title: 'NAV.LEAD_SCORING' },
    loadComponent: () =>
      import('./lead-admin/lead-scoring.component').then((m) => m.LeadScoringComponent),
  },
  {
    path: 'lead-routing',
    data: { breadcrumb: 'NAV.LEAD_ROUTING', title: 'NAV.LEAD_ROUTING' },
    loadComponent: () =>
      import('./lead-admin/lead-routing.component').then((m) => m.LeadRoutingComponent),
  },
  {
    path: 'lead-webhooks',
    data: { breadcrumb: 'NAV.LEAD_WEBHOOKS', title: 'NAV.LEAD_WEBHOOKS' },
    loadComponent: () =>
      import('./lead-admin/lead-webhooks.component').then((m) => m.LeadWebhooksComponent),
  },
  {
    path: 'portal-settings',
    data: { breadcrumb: 'NAV.CRM_PORTAL_SETTINGS', title: 'NAV.CRM_PORTAL_SETTINGS' },
    loadComponent: () =>
      import('./portal-settings/portal-settings.component').then((m) => m.CrmPortalSettingsComponent),
  },
  {
    path: 'engagement',
    data: { breadcrumb: 'BREADCRUMB.ATTIVITA_E_CAMPAGNE', title: 'PAGE_TITLE.ATTIVITA_E_CAMPAGNE' },
    loadChildren: () => import('./engagement/engagement.routes').then((m) => m.ENGAGEMENT_ROUTES),
  },
  {
    path: 'territories',
    data: { breadcrumb: 'NAV.CRMEXT_TERRITORIES', title: 'PAGE_TITLE.CRMEXT_TERRITORIES' },
    loadComponent: () =>
      import('./territories/territories.component').then((m) => m.TerritoriesComponent),
  },
  {
    path: 'territory-accounts',
    data: {
      breadcrumb: 'RES.PAGE.CRM_TERRITORY_ACCOUNTS',
      title: 'RES.PAGE.CRM_TERRITORY_ACCOUNTS',
      page: TERRITORY_ACCOUNTS_PAGE,
    },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'prm-config',
    data: {
      breadcrumb: 'RES.PAGE.CRM_PRM_CONFIG',
      title: 'RES.PAGE.CRM_PRM_CONFIG',
      page: CRM_PRM_CONFIG_PAGE,
    },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'partners',
    data: { breadcrumb: 'NAV.CRMEXT_PARTNERS', title: 'PAGE_TITLE.CRMEXT_PARTNERS' },
    loadComponent: () => import('./partners/partners.component').then((m) => m.PartnersComponent),
  },
  {
    path: 'cpq',
    data: { breadcrumb: 'NAV.CRMEXT_CPQ', title: 'PAGE_TITLE.CRMEXT_CPQ' },
    loadComponent: () => import('./cpq/cpq.component').then((m) => m.CpqComponent),
  },
  {
    path: 'automation',
    data: { breadcrumb: 'NAV.CRMEXT_AUTOMATION', title: 'PAGE_TITLE.CRMEXT_AUTOMATION' },
    loadComponent: () =>
      import('./automation/automation.component').then((m) => m.AutomationComponent),
  },
  {
    path: 'sales-pipeline',
    data: { breadcrumb: 'SALESPIPE.TITLE', title: 'SALESPIPE.TITLE' },
    loadComponent: () =>
      import('./sales-pipeline/sales-pipeline.page').then((m) => m.SalesPipelinePageComponent),
  },
  {
    path: 'pipeline',
    data: { breadcrumb: 'BREADCRUMB.PIPELINE_AND_OPPORTUNITA', title: 'PAGE_TITLE.PIPELINE' },
    loadComponent: () => import('./pipeline/pipeline.component').then((m) => m.PipelineComponent),
  },
];
