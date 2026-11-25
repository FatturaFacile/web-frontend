import { Routes } from '@angular/router';

/** Passenger transport (Mod 176). The parent route guards the module (see `app.routes.ts`). */
export const PASSENGER_TRANSPORT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dispatch' },
  {
    path: 'dispatch',
    data: {
      breadcrumb: 'NAV.PASSENGER_TRANSPORT_DISPATCH',
      title: 'PAGE_TITLE.PASSENGER_TRANSPORT_DISPATCH',
    },
    loadComponent: () => import('./dispatch.component').then((m) => m.DispatchComponent),
  },
  {
    path: 'bookings',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.PASSENGER_TRANSPORT_BOOKINGS',
      title: 'PAGE_TITLE.PASSENGER_TRANSPORT_BOOKINGS',
    },
    loadComponent: () => import('./bookings.component').then((m) => m.BookingsComponent),
  },
  {
    path: 'bookings/:id/sheet',
    data: {
      breadcrumb: 'NAV.PASSENGER_TRANSPORT_SHEET',
      title: 'PAGE_TITLE.PASSENGER_TRANSPORT_SHEET',
    },
    loadComponent: () => import('./service-sheet.component').then((m) => m.ServiceSheetComponent),
  },
  {
    path: 'fleet',
    data: {
      breadcrumb: 'NAV.PASSENGER_TRANSPORT_FLEET',
      title: 'PAGE_TITLE.PASSENGER_TRANSPORT_FLEET',
    },
    loadComponent: () => import('./fleet.component').then((m) => m.FleetComponent),
  },
  {
    path: 'tachograph',
    data: {
      breadcrumb: 'NAV.PASSENGER_TRANSPORT_TACHOGRAPH',
      title: 'PAGE_TITLE.PASSENGER_TRANSPORT_TACHOGRAPH',
    },
    loadComponent: () => import('./tachograph.component').then((m) => m.TachographComponent),
  },
  {
    path: 'contracts-billing',
    data: {
      breadcrumb: 'NAV.PASSENGER_TRANSPORT_CONTRACTS_BILLING',
      title: 'PAGE_TITLE.PASSENGER_TRANSPORT_CONTRACTS_BILLING',
    },
    loadComponent: () =>
      import('./contracts-billing.component').then((m) => m.ContractsBillingComponent),
  },
];
