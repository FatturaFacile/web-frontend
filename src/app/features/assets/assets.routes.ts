import { Routes } from '@angular/router';

export const ASSETS_ROUTES: Routes = [
  {
    path: 'operations',
    data: { breadcrumb: 'NAV.ASSET_OPERATIONS', title: 'NAV.ASSET_OPERATIONS' },
    loadComponent: () =>
      import('./operations/asset-operations.component').then((m) => m.AssetOperationsComponent),
  },
  {
    path: '',
    loadComponent: () => import('./assets.component').then((m) => m.AssetsComponent),
  },
];
