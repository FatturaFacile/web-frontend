import { Routes } from '@angular/router';
import { TREASURY_ADVANCED_PAGE } from './treasury-advanced.page';

export const TREASURY_OPERATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./treasury-operations-shell.component').then((m) => m.TreasuryOperationsShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'balances' },
      {
        path: 'balances',
        loadComponent: () => import('./balances/tr-balances.component').then((m) => m.TrBalancesComponent),
      },
      {
        path: 'cash-registers',
        loadComponent: () => import('./cash/tr-cash-registers.component').then((m) => m.TrCashRegistersComponent),
      },
      {
        path: 'payment-proposals',
        loadComponent: () => import('./proposals/tr-payment-proposals.component').then((m) => m.TrPaymentProposalsComponent),
      },
      {
        path: 'iso20022-import',
        loadComponent: () => import('./iso20022/tr-iso20022-import.component').then((m) => m.TrIso20022ImportComponent),
      },
      {
        path: 'reconciliation-workbench',
        loadComponent: () =>
          import('./iso20022/tr-reconciliation-workbench.component').then((m) => m.TrReconciliationWorkbenchComponent),
      },
      {
        path: 'payment-run',
        loadComponent: () => import('./iso20022/tr-payment-run.component').then((m) => m.TrPaymentRunComponent),
      },
      {
        path: 'payment-flows',
        loadComponent: () => import('./banking/tr-payment-flows.component').then((m) => m.TrPaymentFlowsComponent),
      },
      {
        path: 'f24',
        loadComponent: () => import('./banking/tr-f24.component').then((m) => m.TrF24Component),
      },
      {
        path: 'statement-hub',
        loadComponent: () => import('./banking/tr-statement-hub.component').then((m) => m.TrStatementHubComponent),
      },
      {
        path: 'smart-reconciliation',
        loadComponent: () =>
          import('./banking/tr-smart-reconciliation.component').then((m) => m.TrSmartReconciliationComponent),
      },
      {
        path: 'reconciliation-rules',
        loadComponent: () => import('./rules/tr-reconciliation-rules.component').then((m) => m.TrReconciliationRulesComponent),
      },
      {
        path: 'liquidity',
        loadComponent: () => import('./liquidity/tr-liquidity.component').then((m) => m.TrLiquidityComponent),
      },
      {
        path: 'kpis',
        loadComponent: () => import('./kpis/tr-kpis.component').then((m) => m.TrKpisComponent),
      },
      {
        path: 'riba',
        loadComponent: () => import('./riba/tr-riba.component').then((m) => m.TrRibaComponent),
      },
      {
        path: 'collections',
        loadComponent: () => import('./collections/tr-collections.component').then((m) => m.TrCollectionsComponent),
      },
      {
        path: 'advanced',
        data: { page: TREASURY_ADVANCED_PAGE },
        loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
      },
      {
        path: 'pagopa-notices',
        loadComponent: () => import('./pagopa/tr-pagopa-notices.component').then((m) => m.TrPagoPaNoticesComponent),
      },
    ],
  },
];
