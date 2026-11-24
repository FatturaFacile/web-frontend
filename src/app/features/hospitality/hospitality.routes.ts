import { Routes } from '@angular/router';
import { HOSPITALITY_FLOOR_PAGE } from './back-office/floor.page';
import { HOSPITALITY_LODGING_PAGE } from './back-office/lodging.page';

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
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'availability',
    data: { breadcrumb: 'NAV.HOSPITALITY_AVAILABILITY', title: 'NAV.HOSPITALITY_AVAILABILITY' },
    loadComponent: () => import('./availability-grid.component').then((m) => m.HospitalityAvailabilityGridComponent),
  },
  {
    path: 'lodging',
    data: { breadcrumb: 'RES.PAGE.HOSPITALITY_LODGING', title: 'RES.PAGE.HOSPITALITY_LODGING', page: HOSPITALITY_LODGING_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
