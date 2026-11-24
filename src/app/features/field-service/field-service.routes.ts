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
    path: 'dispatcher',
    data: { breadcrumb: 'NAV.FS_DISPATCHER', title: 'NAV.FS_DISPATCHER' },
    loadComponent: () =>
      import('./dispatcher/dispatcher-board.component').then((m) => m.DispatcherBoardComponent),
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
  {
    path: 'work-orders/:id',
    data: { breadcrumb: 'NAV.FS_WORK_ORDERS', title: 'NAV.FS_WORK_ORDERS' },
    loadComponent: () =>
      import('./work-orders/work-order-detail.component').then((m) => m.WorkOrderDetailComponent),
  },
  {
    path: 'contracts',
    data: { breadcrumb: 'NAV.FS_CONTRACTS', title: 'NAV.FS_CONTRACTS' },
    loadComponent: () =>
      import('./contracts/maintenance-contracts.component').then((m) => m.MaintenanceContractsComponent),
  },
  {
    path: 'equipment',
    data: { breadcrumb: 'NAV.FS_EQUIPMENT', title: 'NAV.FS_EQUIPMENT' },
    loadComponent: () =>
      import('./equipment/equipment-service-history.component').then((m) => m.EquipmentServiceHistoryComponent),
  },
];
