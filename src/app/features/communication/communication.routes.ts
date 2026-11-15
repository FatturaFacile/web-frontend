import { Routes } from '@angular/router';

export const COMMUNICATION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./communication.component').then((m) => m.CommunicationComponent),
  },
  {
    path: 'inbox',
    loadComponent: () =>
      import('./communication-inbox.component').then((m) => m.CommunicationInboxComponent),
  },
  {
    path: 'campaigns',
    loadComponent: () =>
      import('./communication-campaigns.component').then((m) => m.CommunicationCampaignsComponent),
  },
];
