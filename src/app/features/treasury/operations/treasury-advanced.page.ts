import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const BANK_ACCOUNT_FIELDS = [
  req(rf.text('bank_name', { maxLength: 255 })),
  rf.text('branch_name'),
  req(rf.text('iban', { maxLength: 34 })),
  rf.text('bic_swift'),
  rf.text('account_number'),
  req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
  rf.select('account_type', ['checking', 'savings', 'escrow', 'credit_line']),
  rf.decimal('overdraft_limit'),
  rf.bool('is_default'),
  rf.bool('is_active'),
];

const STATEMENT_LINE_FIELDS = [
  rf.date('booking_date'),
  rf.date('value_date'),
  req(rf.decimal('amount')),
  rf.text('bank_reference'),
  rf.text('customer_reference'),
  rf.text('counterparty_name'),
  rf.text('counterparty_iban', { maxLength: 34 }),
  rf.text('remittance_information'),
];

const RIBA_RECEIPT_FIELDS = [
  req(rf.uuid('invoice_id')),
  req(rf.date('due_date')),
  rf.decimal('amount'),
  rf.text('debtor_abi'),
  rf.text('debtor_cab'),
];

/** Treasury back office: bank accounts, payment batch execution, reconciliation, positions and Ri.Ba. creation. */
export const TREASURY_ADVANCED_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.TREASURY_ADVANCED',
  tabs: [
    {
      id: 'bank-accounts',
      titleKey: 'RES.P.bank_accounts',
      module: 'treasury',
      detailPath: '/treasury/bank-accounts/{id}',
      list: {
        path: '/treasury/bank-accounts',
        columns: [...cols('bank_name', 'iban', 'currency'), col('current_balance', 'decimal'), col('is_active', 'bool')],
      },
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/treasury/bank-accounts/{id}', { prefill: true, fields: BANK_ACCOUNT_FIELDS }),
        act('GET', 'RES.A.balances', '/treasury/bank-accounts/{id}/balances', { showResult: true }),
      ],
      toolbar: [
        act('POST', 'RES.A.check_iban', '/treasury/iban/check', { fields: [req(rf.text('iban', { maxLength: 34 }))], showResult: true }),
        act('POST', 'RES.A.open_banking_consent', '/treasury/open-banking/consents', {
          fields: [req(rf.text('iban', { maxLength: 34 }))],
          showResult: true,
        }),
        act('GET', 'RES.A.open_banking_account', '/treasury/open-banking/consents/{id}/account', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.consent_id' }))],
          showResult: true,
        }),
        act('POST', 'RES.A.open_banking_payment', '/treasury/open-banking/payments', {
          fields: [
            req(rf.uuid('consent_id')),
            req(rf.text('creditor_iban', { maxLength: 34 })),
            req(rf.text('creditor_name')),
            req(rf.decimal('amount', { positive: true })),
            req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
            rf.text('remittance_information'),
            rf.uuid('passive_invoice_id'),
          ],
          showResult: true,
        }),
        act('GET', 'RES.A.open_banking_payment_status', '/treasury/open-banking/payments/{id}', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.payment_id' }))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'payment-batches',
      titleKey: 'RES.P.payment_batches',
      module: 'treasury',
      detailPath: '/treasury/payment-batches/{id}',
      list: {
        path: '/treasury/payment-batches',
        columns: [...cols('reference', 'bank_account_id'), tagCol('status'), col('total_amount', 'decimal'), col('execution_date', 'date')],
      },
      rowActions: [
        act('POST', 'RES.A.execute_batch', '/treasury/payment-batches/{id}/execute', {
          fields: [rf.select('protocol', ['sepa_pain001'], { defaultValue: 'sepa_pain001' })],
          showResult: true,
          visible: whenIn('status', 'approved'),
        }),
        act('POST', 'RES.A.confirm_batch', '/treasury/payment-batches/{id}/confirm', {
          fields: [req(rf.text('bank_reference', { maxLength: 100 })), rf.date('value_date')],
          showResult: true,
        }),
        act('POST', 'RES.A.apply_pain002', '/treasury/payment-batches/{id}/pain002', {
          fields: [req(rf.textarea('xml'))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'reconciliations',
      titleKey: 'RES.P.reconciliations',
      module: 'treasury',
      list: {
        path: '/treasury/reconciliations',
        columns: [...cols('bank_statement_id'), tagCol('status'), col('created_at', 'datetime')],
      },
      rowActions: [
        act('POST', 'RES.A.approve', '/treasury/reconciliations/{id}/approve', {
          confirm: true,
          visible: whenIn('status', 'pending', 'completed', 'draft'),
        }),
      ],
      toolbar: [
        act('POST', 'RES.A.auto_reconcile', '/treasury/reconciliations/auto-reconcile', {
          fields: [req(rf.uuid('bank_statement_id'))],
          showResult: true,
        }),
        act('POST', 'RES.A.match_line', '/treasury/reconciliations/lines/{id}/match', {
          fields: [
            req(rf.uuid('id', { labelKey: 'RES.F.line_id' })),
            req(rf.uuid('bank_reconciliation_id')),
            req(rf.text('matched_entity_type')),
            req(rf.uuid('matched_entity_id')),
            rf.decimal('allocated_amount', { positive: true }),
          ],
          showResult: true,
        }),
        act('POST', 'RES.A.import_statement', '/treasury/statements/import', {
          fields: [
            req(rf.uuid('bank_account_id')),
            rf.text('statement_number', { maxLength: 50 }),
            rf.date('statement_date'),
            rf.select('format', ['CAMT_053', 'CAMT_052', 'MT940', 'MT942', 'CSV']),
            rf.decimal('opening_balance'),
            rf.decimal('closing_balance'),
            req(rf.lines('lines', STATEMENT_LINE_FIELDS, { required: true })),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'cash-forecasts',
      titleKey: 'RES.P.cash_forecasts',
      module: 'treasury',
      detailPath: '/treasury/cash-forecasts/{id}',
      list: {
        path: '/treasury/cash-forecasts',
        columns: [
          col('forecast_date', 'date'),
          col('opening_cash_balance', 'decimal'),
          col('closing_cash_balance', 'decimal'),
          col('deficit_detected', 'bool'),
        ],
      },
      rowActions: [act('GET', 'RES.A.evaluate_deficits', '/treasury/cash-forecasts/{id}/evaluate-deficits', { showResult: true })],
    },
    {
      id: 'position-intraday',
      titleKey: 'RES.P.position_intraday',
      module: 'treasury',
      list: { path: '/treasury/positions/intraday', columns: [], filters: [rf.text('currency', { maxLength: 3 })], report: true },
    },
    {
      id: 'position-buffer',
      titleKey: 'RES.P.liquidity_buffer',
      module: 'treasury',
      list: { path: '/treasury/positions/buffer', columns: [], report: true },
    },
    {
      id: 'working-capital',
      titleKey: 'RES.P.working_capital',
      module: 'treasury',
      list: { path: '/treasury/liquidity/working-capital', columns: [], filters: [rf.date('metric_date')], report: true },
      toolbar: [
        act('POST', 'RES.A.sweep_cash_pool', '/treasury/liquidity/pools/{id}/sweep', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.cash_pool_id' }))],
          confirm: true,
          showResult: true,
        }),
        act('POST', 'RES.A.intercompany_transfer', '/treasury/liquidity/intercompany-transfer', {
          fields: [
            req(rf.uuid('source_bank_account_id')),
            req(rf.uuid('destination_bank_account_id', { differentFrom: 'source_bank_account_id' })),
            req(rf.decimal('amount', { positive: true })),
            rf.date('transfer_date'),
            rf.decimal('intercompany_interest_rate'),
            rf.uuid('cash_pool_id'),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'fx-exposure',
      titleKey: 'RES.P.fx_exposure',
      module: 'treasury',
      list: { path: '/treasury/fx/exposure', columns: [], filters: [rf.date('as_of_date')], report: true },
    },
    {
      id: 'riba-create',
      titleKey: 'RES.P.riba_batches',
      module: 'treasury',
      detailPath: '/treasury/riba/batches/{id}',
      list: {
        path: '/treasury/riba/batches',
        columns: [...cols('batch_reference', 'sia_code'), tagCol('status'), col('total_amount', 'decimal')],
      },
      create: act('POST', 'RES.A.new_riba_batch', '/treasury/riba/batches', {
        fields: [
          req(rf.uuid('bank_account_id')),
          req(rf.text('sia_code', { maxLength: 5 })),
          rf.text('batch_reference'),
          req(rf.lines('receipts', RIBA_RECEIPT_FIELDS, { required: true })),
        ],
        showResult: true,
      }),
    },
  ],
};
