import { Routes } from '@angular/router';

export const GELATO_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.GELATO_WORKBENCH', title: 'PAGE_TITLE.GELATO' },
    loadComponent: () => import('./gelato-workbench.component').then((m) => m.GelatoWorkbenchComponent),
  },
  {
    path: 'lots',
    data: { breadcrumb: 'NAV.GELATO_LOTS', title: 'PAGE_TITLE.GELATO' },
    loadComponent: () => import('./gelato-lots.component').then((m) => m.GelatoLotsComponent),
  },
  {
    path: 'ganache',
    data: { breadcrumb: 'NAV.GELATO_GANACHE', title: 'PAGE_TITLE.GELATO' },
    loadComponent: () => import('./gelato-ganache.component').then((m) => m.GelatoGanacheComponent),
  },
  {
    path: 'showcase',
    data: { breadcrumb: 'NAV.GELATO_SHOWCASE', title: 'PAGE_TITLE.GELATO' },
    loadComponent: () => import('./gelato-showcase.component').then((m) => m.GelatoShowcaseComponent),
  },
];
