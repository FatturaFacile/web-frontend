import { Routes } from '@angular/router';

export const ECOMMERCE_INTEGRATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ecommerce-integrations.component').then((m) => m.EcommerceIntegrationsComponent),
  },
];
