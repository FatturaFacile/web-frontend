import { Routes } from '@angular/router';

/** GDO trade terms (Mod 231). The parent route guards the module (see `app.routes.ts`). */
export const GDO_TRADE_TERMS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_DASHBOARD',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_DASHBOARD',
    },
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'contracts',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_CONTRACTS',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_CONTRACTS',
    },
    loadComponent: () => import('./contracts.component').then((m) => m.ContractsComponent),
  },
  {
    path: 'contracts/:id',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_CONTRACT',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_CONTRACT',
    },
    loadComponent: () =>
      import('./contract-detail.component').then((m) => m.ContractDetailComponent),
  },
  {
    path: 'promotions',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_PROMOTIONS',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_PROMOTIONS',
    },
    loadComponent: () => import('./promotions.component').then((m) => m.PromotionsComponent),
  },
  {
    path: 'simulator',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_SIMULATOR',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_SIMULATOR',
    },
    loadComponent: () => import('./simulator.component').then((m) => m.SimulatorComponent),
  },
  {
    path: 'margin',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_MARGIN',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_MARGIN',
    },
    loadComponent: () => import('./margin.component').then((m) => m.MarginComponent),
  },
  {
    path: 'accruals',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_ACCRUALS',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_ACCRUALS',
    },
    loadComponent: () => import('./accruals.component').then((m) => m.AccrualsComponent),
  },
  {
    path: 'settlements',
    pathMatch: 'full',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_SETTLEMENTS',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_SETTLEMENTS',
    },
    loadComponent: () => import('./settlements.component').then((m) => m.SettlementsComponent),
  },
  {
    path: 'settlements/:id',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_SETTLEMENT',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_SETTLEMENT',
    },
    loadComponent: () =>
      import('./settlement-detail.component').then((m) => m.SettlementDetailComponent),
  },
  {
    path: 'delivery-points',
    data: {
      breadcrumb: 'NAV.GDO_TRADE_TERMS_DELIVERY_POINTS',
      title: 'PAGE_TITLE.GDO_TRADE_TERMS_DELIVERY_POINTS',
    },
    loadComponent: () =>
      import('./delivery-points.component').then((m) => m.DeliveryPointsComponent),
  },
];
