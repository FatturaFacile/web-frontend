import { Routes } from '@angular/router';

export const GENERAL_LEDGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./general-ledger-shell.component').then((m) => m.GeneralLedgerShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'journals' },
      {
        path: 'settings',
        loadComponent: () => import('./settings/gl-settings.component').then((m) => m.GlSettingsComponent),
      },
      {
        path: 'accounts',
        loadComponent: () => import('./accounts/gl-accounts.component').then((m) => m.GlAccountsComponent),
      },
      {
        path: 'journals',
        loadComponent: () => import('./journals/gl-journals.component').then((m) => m.GlJournalsComponent),
      },
      {
        path: 'recurring',
        loadComponent: () => import('./recurring/gl-recurring.component').then((m) => m.GlRecurringComponent),
      },
      {
        path: 'accruals',
        loadComponent: () => import('./accruals/gl-accruals.component').then((m) => m.GlAccrualsComponent),
      },
      {
        path: 'close',
        loadComponent: () => import('./close/gl-period-close.component').then((m) => m.GlPeriodCloseComponent),
      },
      {
        path: 'fx-revaluation',
        loadComponent: () => import('./fx/gl-fx-revaluation.component').then((m) => m.GlFxRevaluationComponent),
      },
      {
        path: 'dimensions',
        loadComponent: () => import('./dimensions/gl-dimensions.component').then((m) => m.GlDimensionsComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/gl-reports.component').then((m) => m.GlReportsComponent),
      },
      {
        path: 'budgets',
        loadComponent: () => import('./budgets/gl-budgets.component').then((m) => m.GlBudgetsComponent),
      },
      {
        path: 'fiscal-years',
        loadComponent: () => import('./fiscal-years/gl-fiscal-years.component').then((m) => m.GlFiscalYearsComponent),
      },
    ],
  },
];
