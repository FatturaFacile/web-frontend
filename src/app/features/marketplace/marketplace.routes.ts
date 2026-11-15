import { Routes } from '@angular/router';

export const MARKETPLACE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.MARKETPLACE_CATALOG', title: 'PAGE_TITLE.MARKETPLACE_CATALOG' },
    loadComponent: () => import('./marketplace-catalog.component').then((m) => m.MarketplaceCatalogComponent),
  },
  {
    path: 'installations',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.MARKETPLACE_INSTALLATIONS', title: 'PAGE_TITLE.MARKETPLACE_INSTALLATIONS' },
    loadComponent: () => import('./marketplace-installations.component').then((m) => m.MarketplaceInstallationsComponent),
  },
  {
    path: 'installations/:id',
    data: { breadcrumb: 'NAV.MARKETPLACE_INSTALLATION', title: 'PAGE_TITLE.MARKETPLACE_INSTALLATION' },
    loadComponent: () => import('./marketplace-installation.component').then((m) => m.MarketplaceInstallationComponent),
  },
  {
    path: 'runs',
    data: { breadcrumb: 'NAV.MARKETPLACE_RUNS', title: 'PAGE_TITLE.MARKETPLACE_RUNS' },
    loadComponent: () => import('./marketplace-runs.component').then((m) => m.MarketplaceRunsComponent),
  },
];
