import { Routes } from '@angular/router';

export const COMMUNICATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./communication.component').then((m) => m.CommunicationComponent),
  },
];
