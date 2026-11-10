import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { RETAIL_POS_ADMIN_PAGE } from './back-office/pos-admin.page';

export const RETAIL_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'BREADCRUMB.VENDITA_AL_BANCO_AND_POS', title: 'Vendita al Banco' },
    loadComponent: () =>
      import('./retail.component').then((m) => m.RetailComponent),
  },
  {
    path: 'pos-admin',
    data: { breadcrumb: 'RES.PAGE.RETAIL_POS_ADMIN', title: 'RES.PAGE.RETAIL_POS_ADMIN', page: RETAIL_POS_ADMIN_PAGE },
    component: ResourcePageComponent,
  },
];
