import { Routes } from '@angular/router';

export const TRAVEL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./travel.component').then((m) => m.TravelComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./travel-trip-detail.component').then((m) => m.TravelTripDetailComponent),
  },
];
