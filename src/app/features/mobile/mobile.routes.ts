import { Routes } from '@angular/router';
import { MOBILE_ADMIN_PAGE } from './mobile-admin.page';

export const MOBILE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'RES.PAGE.MOBILE_ADMIN', title: 'RES.PAGE.MOBILE_ADMIN', page: MOBILE_ADMIN_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
