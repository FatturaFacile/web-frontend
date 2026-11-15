import { Routes } from '@angular/router';
import { RETAIL_POS_ADMIN_PAGE } from './back-office/pos-admin.page';

export const RETAIL_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'BREADCRUMB.VENDITA_AL_BANCO_AND_POS', title: 'PAGE_TITLE.VENDITA_AL_BANCO' },
    loadComponent: () =>
      import('./retail.component').then((m) => m.RetailComponent),
  },
  {
    path: 'cashier',
    data: { breadcrumb: 'RES.PAGE.RETAIL_CASHIER', title: 'RES.PAGE.RETAIL_CASHIER' },
    loadComponent: () => import('./cashier/cashier.page').then((m) => m.CashierPage),
  },
  {
    path: 'pos-admin',
    data: { breadcrumb: 'RES.PAGE.RETAIL_POS_ADMIN', title: 'RES.PAGE.RETAIL_POS_ADMIN', page: RETAIL_POS_ADMIN_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
