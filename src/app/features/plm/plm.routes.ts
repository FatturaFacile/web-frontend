import { Routes } from '@angular/router';

export const PLM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.PLM_CHANGE_ORDERS', title: 'PAGE_TITLE.PLM_CHANGE_ORDERS' },
    loadComponent: () => import('./plm-change-orders.component').then((m) => m.PlmChangeOrdersComponent),
  },
  {
    path: 'revisions',
    data: { breadcrumb: 'NAV.PLM_REVISIONS', title: 'PAGE_TITLE.PLM_REVISIONS' },
    loadComponent: () => import('./plm-revisions.component').then((m) => m.PlmRevisionsComponent),
  },
  {
    path: 'change-orders/:id',
    data: { breadcrumb: 'NAV.PLM_CHANGE_ORDER', title: 'PAGE_TITLE.PLM_CHANGE_ORDER' },
    loadComponent: () => import('./plm-change-order-detail.component').then((m) => m.PlmChangeOrderDetailComponent),
  },
];
