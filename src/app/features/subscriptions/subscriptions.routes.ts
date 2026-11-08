import { Routes } from '@angular/router';

export const SUBSCRIPTIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./subscriptions.component').then((m) => m.SubscriptionsComponent),
  },
];
