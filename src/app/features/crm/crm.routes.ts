import { Routes } from '@angular/router';

export const CRM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'clients',
  },
  {
    path: 'clients',
    data: { breadcrumb: 'Clienti Cross-Border', title: 'Anagrafica Clienti' },
    loadComponent: () =>
      import('./clients/clients.component').then((m) => m.CrmClientsComponent),
  },
  {
    path: 'suppliers',
    data: { breadcrumb: 'Fornitori & Listini', title: 'Fornitori & Listini' },
    loadComponent: () =>
      import('./clients/clients.component').then((m) => m.CrmClientsComponent),
  },
  {
    path: 'leads',
    data: { breadcrumb: 'Leads & Scoring', title: 'Leads' },
    loadComponent: () =>
      import('./leads/leads.component').then((m) => m.LeadsComponent),
  },
  {
    path: 'engagement',
    data: { breadcrumb: 'Attività e campagne', title: 'Attività e campagne' },
    loadChildren: () => import('./engagement/engagement.routes').then((m) => m.ENGAGEMENT_ROUTES),
  },
  {
    path: 'pipeline',
    data: { breadcrumb: 'Pipeline & Opportunità', title: 'Pipeline' },
    loadComponent: () =>
      import('./pipeline/pipeline.component').then((m) => m.PipelineComponent),
  },
];
