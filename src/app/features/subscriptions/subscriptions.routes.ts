import { Routes } from '@angular/router';
import { SUBSCRIPTIONS_CATALOG_PAGE } from './subscriptions-catalog.page';

export const SUBSCRIPTIONS_ROUTES: Routes = [
  {
    path: 'billing',
    data: { breadcrumb: 'BREADCRUMB.MODIFICHE_CONTRATTO_E_FATTURAZIONE_A_CONSUMO', title: 'PAGE_TITLE.FATTURAZIONE_ABBONAMENTI' },
    loadComponent: () => import('./billing/subscription-billing.component').then((m) => m.SubscriptionBillingComponent),
  },
  {
    path: 'catalog',
    data: { breadcrumb: 'BREADCRUMB.CATALOGO_PIANI_E_DUNNING', title: 'PAGE_TITLE.CATALOGO_PIANI_E_DUNNING', page: SUBSCRIPTIONS_CATALOG_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: '',
    loadComponent: () => import('./subscriptions.component').then((m) => m.SubscriptionsComponent),
  },
];
