import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const PERIODICITIES = ['monthly', 'quarterly', 'semiannual'] as const;
const AGENT_TYPES = ['single_mandate', 'multi_mandate'] as const;
const STATEMENT_TYPES = ['income_statement', 'balance_sheet'] as const;
const RECONCILIATION_TYPES = ['subledger_ar', 'subledger_ap', 'gr_ir', 'inventory', 'project'] as const;

const FISCAL_YEAR = req(rf.uuid('fiscal_year_id'));

/** Statement endpoints that take only a fiscal year: shown as reports run on demand. */
const yearReport = (id: string, path: string) => ({
  id,
  titleKey: `RES.P.${id.replace(/-/g, '_')}`,
  module: 'ledger',
  list: { path, columns: [], report: true, manual: true, filters: [FISCAL_YEAR] },
});

/** Period statements take an optional fiscal period. */
const periodReport = (id: string, path: string) => ({
  id,
  titleKey: `RES.P.${id.replace(/-/g, '_')}`,
  module: 'ledger',
  list: { path, columns: [], report: true, manual: true, filters: [rf.uuid('fiscal_period_id')] },
});

/** VAT, withholding tax, Enasarco and payroll postings of the general ledger. */
export const GL_TAX_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.GL_TAX',
  tabs: [
    {
      id: 'tax-settlements',
      titleKey: 'RES.P.tax_settlements',
      module: 'ledger',
      detailPath: '/general-ledger/tax-settlements/{id}',
      list: {
        path: '/general-ledger/tax-settlements',
        columns: [
          ...cols('period_type', 'year', 'period'),
          col('vat_payable', 'decimal'),
          col('vat_receivable', 'decimal'),
          col('balance', 'decimal'),
          tagCol('status'),
        ],
      },
      rowActions: [
        act('GET', 'RES.A.settlement_f24', '/general-ledger/tax-settlements/{id}/f24', { showResult: true }),
        act('GET', 'RES.A.download_lipe', '/general-ledger/tax-settlements/{id}/lipe', { download: true }),
        act('GET', 'RES.A.download_statement', '/general-ledger/tax-settlements/{id}/statement', { download: true }),
      ],
    },
    {
      id: 'vat-settings',
      titleKey: 'RES.P.vat_settings',
      module: 'ledger',
      list: { path: '/general-ledger/tax-settings', columns: [], report: true },
      toolbar: [
        act('PUT', 'RES.A.edit_vat_settings', '/general-ledger/tax-settings', {
          fields: [
            rf.select('periodicity', PERIODICITIES),
            rf.tags('output_vat_account_ids'),
            rf.tags('input_vat_account_ids'),
            rf.uuid('settlement_account_id'),
            rf.uuid('interest_expense_account_id'),
            rf.text('declarant_tax_code', { maxLength: 16 }),
            rf.text('declarant_role_code', { maxLength: 2 }),
          ],
        }),
      ],
    },
    {
      id: 'withholding-settlements',
      titleKey: 'RES.P.withholding_settlements',
      module: 'ledger',
      detailPath: '/general-ledger/withholding-settlements/{id}',
      list: {
        path: '/general-ledger/withholding-settlements',
        filters: [rf.text('year'), rf.text('status')],
        columns: [...cols('year', 'month'), col('total_withheld', 'decimal'), col('total_f24', 'decimal'), col('due_date', 'date'), tagCol('status')],
      },
      create: act('POST', 'RES.A.calculate_withholding', '/general-ledger/withholding-settlements/calculate', {
        fields: [req(rf.integer('year', { min: 2000, max: 2100 })), req(rf.integer('month', { min: 1, max: 12 }))],
      }),
      rowActions: [
        act('GET', 'RES.A.withholding_f24', '/general-ledger/withholding-settlements/{id}/f24', { showResult: true }),
        act('POST', 'RES.A.pay_withholding', '/general-ledger/withholding-settlements/{id}/pay', {
          fields: [req(rf.date('payment_date')), rf.uuid('bank_account_id')],
          visible: (row) => String(row['status']) !== 'paid',
        }),
      ],
      toolbar: [
        act('GET', 'RES.A.export_certifications', '/general-ledger/withholding-settlements/certification-export', {
          fields: [req(rf.integer('year', { min: 2000, max: 2100 }))],
          download: true,
        }),
      ],
    },
    {
      id: 'enasarco-parameters',
      titleKey: 'RES.P.enasarco_parameters',
      module: 'ledger',
      list: {
        path: '/general-ledger/enasarco/parameters',
        columns: [...cols('year', 'agent_type'), col('rate_percent', 'decimal'), col('agent_share_percent', 'decimal'), col('annual_ceiling', 'decimal'), ...cols('source')],
      },
      create: act('PUT', 'RES.A.save_enasarco_parameter', '/general-ledger/enasarco/parameters', {
        fields: [
          req(rf.integer('year', { min: 2000, max: 2100 })),
          req(rf.select('agent_type', AGENT_TYPES)),
          req(rf.decimal('rate_percent', { min: 0, max: 100 })),
          req(rf.decimal('agent_share_percent', { min: 0, max: 100 })),
          req(rf.decimal('annual_ceiling', { min: 0 })),
          req(rf.text('source', { maxLength: 255 })),
        ],
      }),
      toolbar: [
        act('GET', 'RES.A.enasarco_summary', '/general-ledger/enasarco/summary', {
          fields: [req(rf.integer('year', { min: 2000, max: 2100 })), rf.integer('quarter', { min: 1, max: 4 })],
          showResult: true,
        }),
        act('GET', 'RES.A.enasarco_statement', '/general-ledger/enasarco/principal-statements', {
          fields: [req(rf.integer('year', { min: 2000, max: 2100 })), req(rf.integer('quarter', { min: 1, max: 4 }))],
          showResult: true,
        }),
        act('POST', 'RES.A.enasarco_post_statement', '/general-ledger/enasarco/principal-statements', {
          fields: [
            req(rf.integer('year', { min: 2000, max: 2100 })),
            req(rf.integer('quarter', { min: 1, max: 4 })),
            req(rf.select('agent_type', AGENT_TYPES)),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'payroll-postings',
      titleKey: 'RES.P.payroll_postings',
      module: 'ledger',
      list: {
        path: '/general-ledger/payroll-postings',
        filters: [rf.text('status')],
        columns: [...cols('payroll_run_id'), col('run_date', 'date'), ...cols('currency'), tagCol('status'), ...cols('journal_entry_id', 'last_error')],
      },
      rowActions: [
        act('POST', 'RES.A.post_payroll_run', '/general-ledger/payroll-postings/{runId}/post', {
          confirm: true,
          visible: whenIn('status', 'pending', 'failed'),
        }),
      ],
    },
  ],
};

/** Reclassified, comparative and period statements, plus the statement schemes that drive them. */
export const GL_STATEMENTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.GL_STATEMENTS',
  tabs: [
    {
      id: 'statement-schemes',
      titleKey: 'RES.P.statement_schemes',
      module: 'ledger',
      list: { path: '/general-ledger/statement-schemes', columns: [...cols('name', 'description'), tagCol('statement_type'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_statement_scheme', '/general-ledger/statement-schemes', {
        fields: [
          req(rf.text('name', { maxLength: 150 })),
          req(rf.select('statement_type', STATEMENT_TYPES)),
          rf.textarea('description'),
          req(
            rf.lines(
              'rows',
              [
                req(rf.text('code', { maxLength: 30 })),
                req(rf.text('label', { maxLength: 150 })),
                req(rf.select('row_type', ['heading', 'accounts', 'subtotal'])),
                rf.select('sign', ['1', '-1']),
              ],
              { required: true },
            ),
          ),
        ],
      }),
      rowActions: [
        act('DELETE', 'RES.ACTION.DELETE', '/general-ledger/statement-schemes/{id}', { confirm: true, danger: true }),
        act('GET', 'RES.A.run_reclassified', '/general-ledger/financial-statements/reclassified', {
          fields: [req(rf.uuid('scheme_id')), FISCAL_YEAR],
          showResult: true,
        }),
      ],
    },
    yearReport('comparative-statements', '/general-ledger/financial-statements/comparative'),
    yearReport('cash-flow-statement', '/general-ledger/financial-statements/cash-flow-statement'),
    yearReport('financial-ratios', '/general-ledger/financial-statements/ratios'),
    periodReport('period-balance-sheet', '/general-ledger/financial-statements/balance-sheet'),
    periodReport('period-income-statement', '/general-ledger/financial-statements/income-statement'),
    periodReport('period-cash-flow', '/general-ledger/financial-statements/cash-flow'),
  ],
};

/** Controls of the ledger: fiscal periods, reconciliations with the subledgers, ledger extract and vendor ageing. */
export const GL_CONTROLS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.GL_CONTROLS',
  tabs: [
    {
      id: 'fiscal-periods',
      titleKey: 'RES.P.fiscal_periods',
      module: 'ledger',
      detailPath: '/general-ledger/fiscal-periods/{id}',
      list: {
        path: '/general-ledger/fiscal-periods',
        columns: [...cols('period_number', 'period_name'), col('start_date', 'date'), col('end_date', 'date'), tagCol('status')],
      },
      create: act('POST', 'RES.A.new_fiscal_period', '/general-ledger/fiscal-periods', {
        fields: [
          req(rf.uuid('fiscal_year_id')),
          req(rf.integer('period_number', { min: 1 })),
          req(rf.text('period_name', { maxLength: 100 })),
          req(rf.date('start_date')),
          req(rf.date('end_date', { notBefore: 'start_date' })),
        ],
      }),
    },
    {
      id: 'ledger-reconciliations',
      titleKey: 'RES.P.ledger_reconciliations',
      module: 'ledger',
      detailPath: '/general-ledger/reconciliations/{id}',
      list: {
        path: '/general-ledger/reconciliations',
        columns: [
          ...cols('reconciliation_type', 'period_id', 'account_id'),
          col('gl_balance', 'decimal'),
          col('subledger_balance', 'decimal'),
          col('variance_amount', 'decimal'),
          tagCol('status'),
          col('reconciled_at', 'datetime'),
        ],
      },
      create: act('POST', 'RES.A.new_reconciliation', '/general-ledger/reconciliations', {
        fields: [req(rf.select('reconciliation_type', RECONCILIATION_TYPES)), req(rf.uuid('fiscal_period_id'))],
      }),
    },
    {
      id: 'customer-subledger',
      titleKey: 'RES.P.customer_subledger',
      module: 'ledger',
      list: {
        path: '/general-ledger/subledgers/customers',
        filters: [rf.lookup('customer_id', 'contacts'), rf.text('status')],
        columns: [...cols('customer_id', 'document_number', 'amount', 'open_amount'), col('due_date', 'date'), tagCol('status')],
      },
    },
    {
      id: 'supplier-subledger',
      titleKey: 'RES.P.supplier_subledger',
      module: 'ledger',
      list: {
        path: '/general-ledger/subledgers/suppliers',
        filters: [rf.lookup('supplier_id', 'suppliers'), rf.text('status')],
        columns: [...cols('supplier_id', 'document_number', 'amount', 'open_amount'), col('due_date', 'date'), tagCol('status')],
      },
    },
    {
      id: 'ledger-extract',
      titleKey: 'RES.P.ledger_extract',
      module: 'ledger',
      list: {
        path: '/accounting/general-ledger',
        columns: [],
        report: true,
        manual: true,
        filters: [
          req(rf.date('from_date')),
          req(rf.date('to_date', { notBefore: 'from_date' })),
          rf.text('account_code'),
          rf.select('source', ['all', 'invoices', 'payments', 'banking']),
        ],
      },
      toolbar: [
        act('GET', 'RES.A.export_ledger', '/accounting/general-ledger/export', {
          fields: [
            req(rf.date('from_date')),
            req(rf.date('to_date', { notBefore: 'from_date' })),
            rf.text('account_code'),
            rf.select('source', ['all', 'invoices', 'payments', 'banking']),
            rf.select('format', ['csv', 'json'], { defaultValue: 'csv' }),
          ],
          download: true,
        }),
      ],
    },
    {
      id: 'vendor-aging',
      titleKey: 'RES.P.vendor_aging',
      module: 'ledger',
      list: {
        path: '/accounting/vendor-aging',
        columns: [],
        report: true,
        manual: true,
        filters: [rf.date('as_of_date'), rf.lookup('supplier_id', 'suppliers')],
      },
    },
  ],
};
