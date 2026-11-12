import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { HOSPITALITY_FLOOR_PAGE } from './back-office/floor.page';

export const HOSPITALITY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'BREADCRUMB.RISTORAZIONE_AND_COMANDE', title: 'PAGE_TITLE.RISTORAZIONE_HOSPITALITY' },
    loadComponent: () =>
      import('./hospitality.component').then((m) => m.HospitalityComponent),
  },
  {
    path: 'floor',
    data: { breadcrumb: 'RES.PAGE.HOSPITALITY_FLOOR', title: 'RES.PAGE.HOSPITALITY_FLOOR', page: HOSPITALITY_FLOOR_PAGE },
    component: ResourcePageComponent,
  },
];
