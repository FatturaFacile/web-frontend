import { Routes } from '@angular/router';

export const SUBSCRIPTIONS_ROUTES: Routes = [
  {
    path: 'billing',
    data: { breadcrumb: 'Modifiche contratto e fatturazione a consumo', title: 'Fatturazione abbonamenti' },
    loadComponent: () => import('./billing/subscription-billing.component').then((m) => m.SubscriptionBillingComponent),
  },
  {
    path: '',
    loadComponent: () => import('./subscriptions.component').then((m) => m.SubscriptionsComponent),
  },
];
