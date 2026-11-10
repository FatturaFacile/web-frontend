import { Routes } from '@angular/router';

export const SUBSCRIPTIONS_ROUTES: Routes = [
  {
    path: 'billing',
    data: { breadcrumb: 'BREADCRUMB.MODIFICHE_CONTRATTO_E_FATTURAZIONE_A_CONSUMO', title: 'Fatturazione abbonamenti' },
    loadComponent: () => import('./billing/subscription-billing.component').then((m) => m.SubscriptionBillingComponent),
  },
  {
    path: '',
    loadComponent: () => import('./subscriptions.component').then((m) => m.SubscriptionsComponent),
  },
];
