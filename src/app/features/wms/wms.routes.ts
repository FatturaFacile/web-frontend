import { Routes } from '@angular/router';
import { WMS_CROSS_DOCK_PAGE, WMS_DOCKS_PAGE, WMS_SLOTTING_PAGE, WMS_TASKS_PAGE } from './wms.pages';

const pageRoute = (path: string, breadcrumb: string, title: string, page: object) => ({
  path,
  data: { breadcrumb, title, page },
  loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
});

export const WMS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.WMS_DASHBOARD', title: 'PAGE_TITLE.WMS_DASHBOARD' },
    loadComponent: () => import('./wms-dashboard.component').then((m) => m.WmsDashboardComponent),
  },
  pageRoute('tasks', 'NAV.WMS_TASKS', 'PAGE_TITLE.WMS_TASKS', WMS_TASKS_PAGE),
  pageRoute('slotting', 'NAV.WMS_SLOTTING', 'PAGE_TITLE.WMS_SLOTTING', WMS_SLOTTING_PAGE),
  pageRoute('cross-dock', 'NAV.WMS_CROSS_DOCK', 'PAGE_TITLE.WMS_CROSS_DOCK', WMS_CROSS_DOCK_PAGE),
  pageRoute('docks', 'NAV.WMS_DOCKS', 'PAGE_TITLE.WMS_DOCKS', WMS_DOCKS_PAGE),
];
