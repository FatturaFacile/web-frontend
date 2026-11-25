import { Routes } from '@angular/router';

export const VAN_SELLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./van-selling-cockpit.component').then((m) => m.VanSellingCockpitComponent),
  },
  {
    path: 'vans',
    data: { initialTab: 0 },
    loadComponent: () =>
      import('./van-selling-cockpit.component').then((m) => m.VanSellingCockpitComponent),
  },
  {
    path: 'load-manifests',
    data: { initialTab: 1 },
    loadComponent: () =>
      import('./van-selling-cockpit.component').then((m) => m.VanSellingCockpitComponent),
  },
  {
    path: 'route-execution',
    data: { initialTab: 2 },
    loadComponent: () =>
      import('./van-selling-cockpit.component').then((m) => m.VanSellingCockpitComponent),
  },
  {
    path: 'offline-sync-print',
    data: { initialTab: 3 },
    loadComponent: () =>
      import('./van-selling-cockpit.component').then((m) => m.VanSellingCockpitComponent),
  },
  {
    path: 'eod-settlement',
    data: { initialTab: 4 },
    loadComponent: () =>
      import('./van-selling-cockpit.component').then((m) => m.VanSellingCockpitComponent),
  },
];
