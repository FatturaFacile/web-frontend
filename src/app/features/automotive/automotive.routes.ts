import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { AUTOMOTIVE_INSPECTIONS_PAGE } from './inspections.page';
import { AUTOMOTIVE_SCHEDULE_PAGE } from './schedule.page';
import { AUTOMOTIVE_ESTIMATES_PAGE, AUTOMOTIVE_PARTS_PAGE, AUTOMOTIVE_WARRANTY_PAGE } from './workshop-back-office.page';

export const AUTOMOTIVE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tire-hotel',
  },
  {
    path: 'tire-hotel',
    data: { breadcrumb: 'BREADCRUMB.HOTEL_PNEUMATICI', title: 'PAGE_TITLE.HOTEL_PNEUMATICI' },
    loadComponent: () =>
      import('./tire-hotel.component').then((m) => m.TireHotelComponent),
  },
  {
    path: 'inspections',
    data: { breadcrumb: 'RES.PAGE.AUTOMOTIVE_INSPECTIONS', title: 'RES.PAGE.AUTOMOTIVE_INSPECTIONS', page: AUTOMOTIVE_INSPECTIONS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'schedule',
    data: { breadcrumb: 'RES.PAGE.AUTOMOTIVE_SCHEDULE', title: 'RES.PAGE.AUTOMOTIVE_SCHEDULE', page: AUTOMOTIVE_SCHEDULE_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'estimates',
    data: { breadcrumb: 'RES.PAGE.AUTOMOTIVE_ESTIMATES', title: 'RES.PAGE.AUTOMOTIVE_ESTIMATES', page: AUTOMOTIVE_ESTIMATES_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'warranty',
    data: { breadcrumb: 'RES.PAGE.AUTOMOTIVE_WARRANTY', title: 'RES.PAGE.AUTOMOTIVE_WARRANTY', page: AUTOMOTIVE_WARRANTY_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'parts',
    data: { breadcrumb: 'RES.PAGE.AUTOMOTIVE_PARTS', title: 'RES.PAGE.AUTOMOTIVE_PARTS', page: AUTOMOTIVE_PARTS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'workshop',
    data: { breadcrumb: 'BREADCRUMB.OFFICINA_AND_SCHEDE', title: 'PAGE_TITLE.OFFICINA' },
    loadComponent: () =>
      import('./workshop/workshop.component').then((m) => m.WorkshopComponent),
  },
];
