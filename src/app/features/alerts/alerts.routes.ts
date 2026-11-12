import { Routes } from '@angular/router';

export const ALERTS_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'BREADCRUMB.CENTRO_AVVISI', title: 'PAGE_TITLE.CENTRO_AVVISI_NOTIFICHE' },
    loadComponent: () =>
      import('./alerts.component').then((m) => m.AlertsComponent),
  },
];
