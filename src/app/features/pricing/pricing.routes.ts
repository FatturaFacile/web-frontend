import { Routes } from '@angular/router';

export const PRICING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.PRICING_LISTS', title: 'PAGE_TITLE.PRICING_LISTS' },
    loadComponent: () =>
      import('./pricing-price-lists.component').then((m) => m.PricingPriceListsComponent),
  },
  {
    path: 'commercial',
    data: { breadcrumb: 'NAV.PRICING_COMMERCIAL', title: 'PAGE_TITLE.PRICING_COMMERCIAL' },
    loadComponent: () =>
      import('./pricing-commercial.component').then((m) => m.PricingCommercialComponent),
  },
];
