import { Routes } from '@angular/router';

export const AUTOMOTIVE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tire-hotel',
  },
  {
    path: 'tire-hotel',
    data: { breadcrumb: 'Hotel Pneumatici', title: 'Hotel Pneumatici' },
    loadComponent: () =>
      import('./tire-hotel.component').then((m) => m.TireHotelComponent),
  },
  {
    path: 'workshop',
    data: { breadcrumb: 'Officina & Schede', title: 'Officina' },
    loadComponent: () =>
      import('./tire-hotel.component').then((m) => m.TireHotelComponent),
  },
];
