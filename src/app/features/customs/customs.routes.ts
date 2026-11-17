import { Routes } from '@angular/router';
import { CUSTOMS_ASSESSMENTS_PAGE } from './back-office/assessments.page';
import { CUSTOMS_OPERATIONS_PAGE } from './back-office/operations.page';
import { CUSTOMS_SETUP_PAGE } from './back-office/setup.page';

export const CUSTOMS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./customs.component').then((m) => m.CustomsComponent),
  },
  {
    path: 'operations',
    data: { breadcrumb: 'RES.PAGE.CUSTOMS_OPERATIONS', title: 'RES.PAGE.CUSTOMS_OPERATIONS', page: CUSTOMS_OPERATIONS_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'assessments',
    data: { breadcrumb: 'RES.PAGE.CUSTOMS_ASSESSMENTS', title: 'RES.PAGE.CUSTOMS_ASSESSMENTS', page: CUSTOMS_ASSESSMENTS_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
  {
    path: 'taric-codes',
    data: { breadcrumb: 'NAV.CUSTOMS_TARIC_CODES', title: 'NAV.CUSTOMS_TARIC_CODES' },
    loadComponent: () => import('./codes/taric-codes.component').then((m) => m.TaricCodesComponent),
  },
  {
    path: 'free-trade-agreements',
    data: { breadcrumb: 'NAV.CUSTOMS_FREE_TRADE_AGREEMENTS', title: 'NAV.CUSTOMS_FREE_TRADE_AGREEMENTS' },
    loadComponent: () =>
      import('./codes/free-trade-agreements.component').then((m) => m.FreeTradeAgreementsComponent),
  },
  {
    path: 'trade-compliance',
    data: { breadcrumb: 'NAV.CUSTOMS_TRADE_COMPLIANCE', title: 'NAV.CUSTOMS_TRADE_COMPLIANCE' },
    loadComponent: () =>
      import('./trade-compliance/trade-compliance.component').then((m) => m.TradeComplianceComponent),
  },
  {
    path: 'setup',
    data: { breadcrumb: 'RES.PAGE.CUSTOMS_SETUP', title: 'RES.PAGE.CUSTOMS_SETUP', page: CUSTOMS_SETUP_PAGE },
    loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
  },
];
