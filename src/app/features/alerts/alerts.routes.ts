import { Routes } from '@angular/router';

export const ALERTS_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'Centro Avvisi', title: 'Centro Avvisi & Notifiche' },
    loadComponent: () =>
      import('./alerts.component').then((m) => m.AlertsComponent),
  },
];
