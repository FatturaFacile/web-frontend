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
      import('./service-reports/service-reports.component').then((m) => m.ServiceReportsComponent),
  },
  {
    path: 'work-orders',
    data: { breadcrumb: 'Ordini di lavoro', title: 'Ordini di lavoro' },
    loadComponent: () =>
      import('./work-orders/field-work-orders.component').then((m) => m.FieldWorkOrdersComponent),
  },
];
