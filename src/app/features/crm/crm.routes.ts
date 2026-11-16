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
    path: 'leads',
    data: { breadcrumb: 'Lead', title: 'Lead & Acquisizione' },
    loadComponent: () => import('./leads/leads.component').then((m) => m.LeadsComponent),
  },
  {
    path: 'lead-settings',
    data: { breadcrumb: 'Configurazione Lead', title: 'Configurazione acquisizione lead' },
    loadComponent: () =>
      import('./leads/lead-settings.component').then((m) => m.LeadSettingsComponent),
  },
  {
    path: 'suppliers',
    data: { breadcrumb: 'Fornitori & Listini', title: 'Fornitori & Listini' },
    loadComponent: () =>
      import('./clients/clients.component').then((m) => m.CrmClientsComponent),
  },
];
