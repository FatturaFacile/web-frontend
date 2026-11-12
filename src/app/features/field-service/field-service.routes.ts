import { Routes } from '@angular/router';

export const FIELD_SERVICE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tickets',
  },
  {
    path: 'tickets',
    data: { breadcrumb: 'BREADCRUMB.TICKET_HELPDESK_SLA', title: 'PAGE_TITLE.TICKET_HELPDESK' },
    loadComponent: () =>
      import('./field-service.component').then((m) => m.FieldServiceComponent),
  },
  {
    path: 'reports',
    data: { breadcrumb: 'BREADCRUMB.RAPPORTINI_INTERVENTO', title: 'PAGE_TITLE.RAPPORTINI' },
    loadComponent: () =>
      import('./service-reports/service-reports.component').then((m) => m.ServiceReportsComponent),
  },
  {
    path: 'work-orders',
    data: { breadcrumb: 'BREADCRUMB.ORDINI_DI_LAVORO', title: 'PAGE_TITLE.ORDINI_DI_LAVORO' },
    loadComponent: () =>
      import('./work-orders/field-work-orders.component').then((m) => m.FieldWorkOrdersComponent),
  },
];
