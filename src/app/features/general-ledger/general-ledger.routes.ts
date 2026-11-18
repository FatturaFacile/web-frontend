import { Routes } from '@angular/router';
import { GL_CONTROLS_PAGE, GL_STATEMENTS_PAGE, GL_TAX_PAGE } from './fiscal/gl-fiscal.pages';

export const GENERAL_LEDGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./general-ledger-shell.component').then((m) => m.GeneralLedgerShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'journals' },
      {
        path: 'fiscal',
        data: { page: GL_TAX_PAGE },
        loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
      },
      {
        path: 'statements-extra',
        data: { page: GL_STATEMENTS_PAGE },
        loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
      },
      {
        path: 'controls',
        data: { page: GL_CONTROLS_PAGE },
        loadComponent: () => import('@shared').then((m) => m.ResourcePageComponent),
      },
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
        path: 'consolidation',
        loadComponent: () => import('./consolidation/gl-consolidation-groups.component').then((m) => m.GlConsolidationGroupsComponent),
      },
      {
        path: 'consolidation/runs/:runId',
        loadComponent: () => import('./consolidation/gl-consolidation-run-detail.component').then((m) => m.GlConsolidationRunDetailComponent),
      },
      {
        path: 'consolidation/:id',
        loadComponent: () => import('./consolidation/gl-consolidation-group-detail.component').then((m) => m.GlConsolidationGroupDetailComponent),
      },
      {
        path: 'localization',
        loadComponent: () => import('./localization/gl-localization-packs.component').then((m) => m.GlLocalizationPacksComponent),
      },
      {
        path: 'country-returns',
        loadComponent: () => import('./localization/gl-country-returns.component').then((m) => m.GlCountryReturnsComponent),
      },
      {
        path: 'lettering',
        loadComponent: () => import('./localization/gl-lettering.component').then((m) => m.GlLetteringComponent),
      },
      {
        path: 'us-sales-tax',
        loadComponent: () => import('./localization/gl-us-sales-tax.component').then((m) => m.GlUsSalesTaxComponent),
      },
      {
        path: 'us-1099',
        loadComponent: () => import('./localization/gl-us-1099.component').then((m) => m.GlUs1099Component),
      },
      {
        path: 'vat-settlement',
        loadComponent: () => import('./vat/gl-vat-settlement.component').then((m) => m.GlVatSettlementComponent),
      },
      {
        path: 'vat-settings',
        loadComponent: () => import('./vat/gl-vat-settings.component').then((m) => m.GlVatSettingsComponent),
      },
      {
        path: 'fiscal-years',
        loadComponent: () => import('./fiscal-years/gl-fiscal-years.component').then((m) => m.GlFiscalYearsComponent),
      },
    ],
  },
];
