import { Routes } from '@angular/router';

/** Sales cycle on the core `/sales/*` endpoints, mounted under `/sales/cycle`. */
export const CYCLE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    data: { breadcrumb: 'BREADCRUMB.PANORAMICA_VENDITE', title: 'Panoramica vendite' },
    loadComponent: () => import('./overview/sales-overview.component').then((m) => m.SalesOverviewComponent),
  },
  {
    path: 'quotes',
    data: { breadcrumb: 'BREADCRUMB.PREVENTIVI', title: 'Preventivi' },
    loadComponent: () => import('./quotes/quotes.component').then((m) => m.CycleQuotesComponent),
  },
  {
    path: 'orders',
    data: { breadcrumb: 'BREADCRUMB.ORDINI_CLIENTE', title: 'Ordini cliente' },
    loadComponent: () => import('./orders/orders.component').then((m) => m.CycleOrdersComponent),
  },
  {
    path: 'delivery-notes',
    data: { breadcrumb: 'BREADCRUMB.DDT', title: 'DDT' },
    loadComponent: () =>
      import('./delivery-notes/delivery-notes.component').then((m) => m.CycleDeliveryNotesComponent),
  },
  {
    path: 'returns',
    data: { breadcrumb: 'BREADCRUMB.RESI', title: 'Resi clienti' },
    loadComponent: () => import('./returns/returns.component').then((m) => m.CycleReturnsComponent),
  },
  {
    path: 'pricing',
    data: { breadcrumb: 'BREADCRUMB.PREZZI_E_SCONTI', title: 'Prezzi e sconti' },
    loadComponent: () => import('./pricing/discount-policies.component').then((m) => m.DiscountPoliciesComponent),
  },
  {
    path: 'credit',
    data: { breadcrumb: 'BREADCRUMB.FIDO_CLIENTI', title: 'Fido clienti' },
    loadComponent: () => import('./credit/customer-credit.component').then((m) => m.CustomerCreditComponent),
  },
];
