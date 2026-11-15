import { Routes } from '@angular/router';

export const REBATES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.REBATES_DASHBOARD', title: 'PAGE_TITLE.REBATES_DASHBOARD' },
    loadComponent: () => import('./rebates-dashboard.component').then((m) => m.RebatesDashboardComponent),
  },
  {
    path: 'agreements',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.REBATES_AGREEMENTS', title: 'PAGE_TITLE.REBATES_AGREEMENTS' },
    loadComponent: () => import('./rebates-agreements.component').then((m) => m.RebatesAgreementsComponent),
  },
  {
    path: 'agreements/:id',
    data: { breadcrumb: 'NAV.REBATES_AGREEMENT', title: 'PAGE_TITLE.REBATES_AGREEMENT' },
    loadComponent: () => import('./rebates-agreement-detail.component').then((m) => m.RebatesAgreementDetailComponent),
  },
  {
    path: 'promotions',
    data: { breadcrumb: 'NAV.REBATES_PROMOTIONS', title: 'PAGE_TITLE.REBATES_PROMOTIONS' },
    loadComponent: () => import('./rebates-promotions.component').then((m) => m.RebatesPromotionsComponent),
  },
];
