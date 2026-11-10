import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { CUSTOMS_ASSESSMENTS_PAGE } from './back-office/assessments.page';
import { CUSTOMS_OPERATIONS_PAGE } from './back-office/operations.page';
import { CUSTOMS_SETUP_PAGE } from './back-office/setup.page';

export const CUSTOMS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./customs.component').then((m) => m.CustomsComponent),
  },
  {
    path: 'operations',
    data: { breadcrumb: 'RES.PAGE.CUSTOMS_OPERATIONS', title: 'RES.PAGE.CUSTOMS_OPERATIONS', page: CUSTOMS_OPERATIONS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'assessments',
    data: { breadcrumb: 'RES.PAGE.CUSTOMS_ASSESSMENTS', title: 'RES.PAGE.CUSTOMS_ASSESSMENTS', page: CUSTOMS_ASSESSMENTS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'setup',
    data: { breadcrumb: 'RES.PAGE.CUSTOMS_SETUP', title: 'RES.PAGE.CUSTOMS_SETUP', page: CUSTOMS_SETUP_PAGE },
    component: ResourcePageComponent,
  },
];
