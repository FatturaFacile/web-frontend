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
    data: { breadcrumb: 'Leads', title: 'Leads' },
    loadComponent: () => import('./leads/leads.component').then((m) => m.LeadsComponent),
  },
  {
    path: 'leads/duplicates',
    data: { breadcrumb: 'Lead duplicates', title: 'Lead duplicates' },
    loadComponent: () =>
      import('./leads/lead-duplicates.component').then((m) => m.LeadDuplicatesComponent),
  },
  {
    path: 'leads/:id',
    data: { breadcrumb: 'Lead', title: 'Lead' },
    loadComponent: () => import('./leads/lead-detail.component').then((m) => m.LeadDetailComponent),
  },
  {
    path: 'lead-sources',
    data: { breadcrumb: 'Lead sources', title: 'Lead sources' },
    loadComponent: () =>
      import('./lead-admin/lead-sources.component').then((m) => m.LeadSourcesComponent),
  },
  {
    path: 'lead-scoring',
    data: { breadcrumb: 'Lead scoring', title: 'Lead scoring' },
    loadComponent: () =>
      import('./lead-admin/lead-scoring.component').then((m) => m.LeadScoringComponent),
  },
  {
    path: 'lead-routing',
    data: { breadcrumb: 'Lead routing', title: 'Lead routing' },
    loadComponent: () =>
      import('./lead-admin/lead-routing.component').then((m) => m.LeadRoutingComponent),
  },
];
