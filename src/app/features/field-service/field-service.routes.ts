import { Routes } from '@angular/router';

export const FIELD_SERVICE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tickets',
  },
  {
    path: 'tickets',
    data: { breadcrumb: 'Ticket Helpdesk SLA', title: 'Ticket Helpdesk' },
    loadComponent: () =>
      import('./field-service.component').then((m) => m.FieldServiceComponent),
  },
  {
    path: 'reports',
    data: { breadcrumb: 'Rapportini Intervento', title: 'Rapportini' },
    loadComponent: () =>
      import('./field-service.component').then((m) => m.FieldServiceComponent),
  },
];
