import { Routes } from '@angular/router';
import { ASSET_LIFECYCLE_PAGE } from './operations/asset-lifecycle.page';

export const ASSETS_ROUTES: Routes = [
  {
    path: 'operations',
    data: { breadcrumb: 'NAV.ASSET_OPERATIONS', title: 'NAV.ASSET_OPERATIONS' },
    loadComponent: () =>
      import('./operations/asset-operations.component').then((m) => m.AssetOperationsComponent),
  },
  {
    path: 'lifecycle',
    data: { breadcrumb: 'RES.PAGE.EAM_LIFECYCLE', title: 'RES.PAGE.EAM_LIFECYCLE', page: ASSET_LIFECYCLE_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: '',
    loadComponent: () => import('./assets.component').then((m) => m.AssetsComponent),
  },
];
