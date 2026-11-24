import { Routes } from '@angular/router';
import { BI_LIBRARY_PAGE } from './bi-library.page';

export const BUSINESS_INTELLIGENCE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.BI_DASHBOARDS', title: 'PAGE_TITLE.BI_DASHBOARDS' },
    loadComponent: () => import('./bi-dashboards.component').then((m) => m.BiDashboardsComponent),
  },
  {
    path: 'dashboards/:id',
    data: { breadcrumb: 'NAV.BI_DASHBOARD', title: 'PAGE_TITLE.BI_DASHBOARD' },
    loadComponent: () => import('./bi-dashboard.component').then((m) => m.BiDashboardComponent),
  },
  {
    path: 'explorer',
    data: { breadcrumb: 'NAV.BI_EXPLORER', title: 'PAGE_TITLE.BI_EXPLORER' },
    loadComponent: () => import('./bi-explorer.component').then((m) => m.BiExplorerComponent),
  },
  {
    path: 'queries',
    data: { breadcrumb: 'NAV.BI_QUERIES', title: 'PAGE_TITLE.BI_QUERIES' },
    loadComponent: () => import('./bi-queries.component').then((m) => m.BiQueriesComponent),
  },
  {
    path: 'measures',
    data: { breadcrumb: 'NAV.BI_MEASURES', title: 'PAGE_TITLE.BI_MEASURES' },
    loadComponent: () => import('./bi-measures.component').then((m) => m.BiMeasuresComponent),
  },
  {
    path: 'library',
    data: { breadcrumb: 'RES.PAGE.BI_LIBRARY', title: 'RES.PAGE.BI_LIBRARY', page: BI_LIBRARY_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
