import { Routes } from '@angular/router';

/**
 * Multi-currency engine (Mod 003), mounted at `finance/currencies` (see `app.routes.ts`): the rates page with its
 * synchronisation, exposure and settings tabs, and the period-end FX revaluation wizard at `finance/currencies/revaluation`.
 */
export const CURRENCY_FX_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { breadcrumb: 'NAV.FINANCE_CURRENCIES', title: 'PAGE_TITLE.FINANCE_CURRENCIES' },
    loadComponent: () =>
      import('./currency-rates-page.component').then((m) => m.CurrencyRatesPageComponent),
  },
  {
    path: 'revaluation',
    data: { breadcrumb: 'NAV.FX_REVALUATION', title: 'PAGE_TITLE.FX_REVALUATION' },
    loadComponent: () =>
      import('./fx-revaluation-wizard.component').then((m) => m.FxRevaluationWizardComponent),
  },
];
