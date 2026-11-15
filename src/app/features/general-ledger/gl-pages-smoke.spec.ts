import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../testing/component-smoke';
import { GlAccountsComponent } from './accounts/gl-accounts.component';
import { GlAccrualsComponent } from './accruals/gl-accruals.component';
import { GlBudgetsComponent } from './budgets/gl-budgets.component';
import { GlDimensionTableComponent } from './dimensions/gl-dimension-table.component';
import { GlDimensionsComponent } from './dimensions/gl-dimensions.component';
import { GlFiscalYearsComponent } from './fiscal-years/gl-fiscal-years.component';
import { GlFxRevaluationComponent } from './fx/gl-fx-revaluation.component';
import { GeneralLedgerShellComponent } from './general-ledger-shell.component';
import { GlRecurringComponent } from './recurring/gl-recurring.component';
import { GlAccountLedgerComponent } from './reports/gl-account-ledger.component';
import { GlDimensionReportComponent } from './reports/gl-dimension-report.component';
import { GlReportsComponent } from './reports/gl-reports.component';
import { GlStatementsComponent } from './reports/gl-statements.component';
import { GlTrialBalanceComponent } from './reports/gl-trial-balance.component';
import { GlVatRegistersComponent } from './reports/gl-vat-registers.component';

describe('General ledger pages boot against an empty backend', () => {
  const pages = [
    ['accounts', GlAccountsComponent, {}],
    ['accruals', GlAccrualsComponent, {}],
    ['budgets', GlBudgetsComponent, {}],
    ['dimension table (cost)', GlDimensionTableComponent, { kind: 'cost' }],
    ['dimensions', GlDimensionsComponent, {}],
    ['fiscal years', GlFiscalYearsComponent, {}],
    ['FX revaluation', GlFxRevaluationComponent, {}],
    ['shell', GeneralLedgerShellComponent, {}],
    ['recurring journals', GlRecurringComponent, {}],
    ['account ledger', GlAccountLedgerComponent, {}],
    ['dimension report', GlDimensionReportComponent, {}],
    ['reports', GlReportsComponent, {}],
    ['statements (balance sheet)', GlStatementsComponent, { mode: 'balance-sheet' }],
    ['trial balance', GlTrialBalanceComponent, {}],
    ['VAT registers', GlVatRegistersComponent, {}],
  ] as const;

  it.each(pages)('%s', async (_name, component, inputs) => {
    const { fixture } = await renderPageWithEmptyBackend(component, { ...inputs });

    expect(fixture.nativeElement).toBeTruthy();
  });
});
