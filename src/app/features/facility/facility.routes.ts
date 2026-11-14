import { Routes } from '@angular/router';

export const FACILITY_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.FACILITY_BOOKINGS', title: 'PAGE_TITLE.FACILITY_BOOKINGS' },
    loadComponent: () => import('./facility-bookings.component').then((m) => m.FacilityBookingsComponent),
  },
  {
    path: 'spaces',
    data: { breadcrumb: 'NAV.FACILITY_SPACES', title: 'PAGE_TITLE.FACILITY_SPACES' },
    loadComponent: () => import('./facility-spaces.component').then((m) => m.FacilitySpacesComponent),
  },
  {
    path: 'requests',
    data: { breadcrumb: 'NAV.FACILITY_REQUESTS', title: 'PAGE_TITLE.FACILITY_REQUESTS' },
    loadComponent: () => import('./facility-requests.component').then((m) => m.FacilityRequestsComponent),
  },
  {
    path: 'inspections',
    data: { breadcrumb: 'NAV.FACILITY_INSPECTIONS', title: 'PAGE_TITLE.FACILITY_INSPECTIONS' },
    loadComponent: () => import('./facility-inspections.component').then((m) => m.FacilityInspectionsComponent),
  },
  {
    path: 'meters',
    data: { breadcrumb: 'NAV.FACILITY_METERS', title: 'PAGE_TITLE.FACILITY_METERS' },
    loadComponent: () => import('./facility-meters.component').then((m) => m.FacilityMetersComponent),
  },
];
