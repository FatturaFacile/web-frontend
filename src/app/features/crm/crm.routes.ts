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
];
