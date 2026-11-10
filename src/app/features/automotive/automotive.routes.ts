import { Routes } from '@angular/router';
import { ResourcePageComponent } from '@shared';
import { AUTOMOTIVE_INSPECTIONS_PAGE } from './inspections.page';

export const AUTOMOTIVE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tire-hotel',
  },
  {
    path: 'tire-hotel',
    data: { breadcrumb: 'BREADCRUMB.HOTEL_PNEUMATICI', title: 'Hotel Pneumatici' },
    loadComponent: () =>
      import('./tire-hotel.component').then((m) => m.TireHotelComponent),
  },
  {
    path: 'inspections',
    data: { breadcrumb: 'RES.PAGE.AUTOMOTIVE_INSPECTIONS', title: 'RES.PAGE.AUTOMOTIVE_INSPECTIONS', page: AUTOMOTIVE_INSPECTIONS_PAGE },
    component: ResourcePageComponent,
  },
  {
    path: 'workshop',
    data: { breadcrumb: 'BREADCRUMB.OFFICINA_AND_SCHEDE', title: 'Officina' },
    loadComponent: () =>
      import('./workshop/workshop.component').then((m) => m.WorkshopComponent),
  },
];
