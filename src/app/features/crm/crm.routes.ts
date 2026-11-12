import { Routes } from '@angular/router';

export const CRM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'clients',
  },
  {
    path: 'clients',
    data: { breadcrumb: 'BREADCRUMB.CLIENTI_CROSS_BORDER', title: 'PAGE_TITLE.ANAGRAFICA_CLIENTI' },
    loadComponent: () =>
      import('./clients/clients.component').then((m) => m.CrmClientsComponent),
  },
  {
    path: 'suppliers',
    data: { breadcrumb: 'BREADCRUMB.FORNITORI_AND_LISTINI', title: 'PAGE_TITLE.FORNITORI_LISTINI' },
    loadComponent: () =>
      import('./clients/clients.component').then((m) => m.CrmClientsComponent),
  },
  {
    path: 'leads',
    data: { breadcrumb: 'BREADCRUMB.LEADS_AND_SCORING', title: 'PAGE_TITLE.LEADS' },
    loadComponent: () =>
      import('./leads/leads.component').then((m) => m.LeadsComponent),
  },
  {
    path: 'engagement',
    data: { breadcrumb: 'BREADCRUMB.ATTIVITA_E_CAMPAGNE', title: 'PAGE_TITLE.ATTIVITA_E_CAMPAGNE' },
    loadChildren: () => import('./engagement/engagement.routes').then((m) => m.ENGAGEMENT_ROUTES),
  },
  {
    path: 'pipeline',
    data: { breadcrumb: 'BREADCRUMB.PIPELINE_AND_OPPORTUNITA', title: 'PAGE_TITLE.PIPELINE' },
    loadComponent: () =>
      import('./pipeline/pipeline.component').then((m) => m.PipelineComponent),
  },
];
