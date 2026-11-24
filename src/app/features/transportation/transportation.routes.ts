import { Route, Routes } from '@angular/router';
import { TMS_AUDIT_PAGE, TMS_CARRIERS_PAGE, TMS_ORDERS_PAGE, TMS_QUOTES_PAGE, TMS_TRIPS_PAGE } from './transportation.pages';

const pageRoute = (path: string, breadcrumb: string, title: string, page: object) => ({
  path,
  data: { breadcrumb, title, page },
  loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
});

const detailRoute = (path: string, breadcrumb: string, title: string, loadComponent: Route['loadComponent']): Route => ({
  path,
  data: { breadcrumb, title },
  loadComponent,
});

export const TRANSPORTATION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.TMS_DASHBOARD', title: 'PAGE_TITLE.TMS_DASHBOARD' },
    loadComponent: () => import('./transportation-dashboard.component').then((m) => m.TransportationDashboardComponent),
  },
  pageRoute('carriers', 'NAV.TMS_CARRIERS', 'PAGE_TITLE.TMS_CARRIERS', TMS_CARRIERS_PAGE),
  detailRoute('carriers/:id', 'NAV.TMS_CARRIER', 'PAGE_TITLE.TMS_CARRIER', () => import('./tms-carrier-detail.component').then((m) => m.TmsCarrierDetailComponent)),
  detailRoute('tariffs/:id', 'NAV.TMS_TARIFF', 'PAGE_TITLE.TMS_TARIFF', () => import('./tms-tariff-detail.component').then((m) => m.TmsTariffDetailComponent)),
  pageRoute('orders', 'NAV.TMS_ORDERS', 'PAGE_TITLE.TMS_ORDERS', TMS_ORDERS_PAGE),
  detailRoute('orders/:id', 'NAV.TMS_ORDER', 'PAGE_TITLE.TMS_ORDER', () => import('./tms-order-detail.component').then((m) => m.TmsOrderDetailComponent)),
  pageRoute('trips', 'NAV.TMS_TRIPS', 'PAGE_TITLE.TMS_TRIPS', TMS_TRIPS_PAGE),
  detailRoute('trips/:id', 'NAV.TMS_TRIP', 'PAGE_TITLE.TMS_TRIP', () => import('./tms-trip-detail.component').then((m) => m.TmsTripDetailComponent)),
  pageRoute('quotes', 'NAV.TMS_QUOTES', 'PAGE_TITLE.TMS_QUOTES', TMS_QUOTES_PAGE),
  pageRoute('audit', 'NAV.TMS_AUDIT', 'PAGE_TITLE.TMS_AUDIT', TMS_AUDIT_PAGE),
];
