import { Routes } from '@angular/router';

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
    ],
  },
];
