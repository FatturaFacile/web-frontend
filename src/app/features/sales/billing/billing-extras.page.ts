import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card', 'cheque', 'direct_debit', 'other'] as const;

const RECORD_PAYMENT_FIELDS = [
  req(rf.decimal('amount', { positive: true })),
  req(rf.date('payment_date')),
  req(rf.select('payment_method', PAYMENT_METHODS)),
  rf.uuid('bank_account_id'),
  rf.textarea('notes'),
];

/** Invoices that still have something to collect. */
const OPEN_INVOICE = (row: Record<string, unknown>): boolean => !['paid', 'cancelled', 'draft'].includes(String(row['payment_status'] ?? row['status']));

/** Collections of issued invoices: payments, reminders and bank-statement imports. */
export const INVOICE_COLLECTIONS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.INVOICE_COLLECTIONS',
  tabs: [
    {
      id: 'invoice-collections',
      titleKey: 'RES.P.invoice_collections',
      module: 'invoicing',
      detailPath: '/sales/invoices/{id}',
      list: {
        path: '/sales/invoices',
        filters: [rf.text('status'), rf.text('payment_status')],
        columns: [
          ...cols('invoice_number'),
          col('issue_date', 'date'),
          col('due_date', 'date'),
          tagCol('status'),
          tagCol('payment_status'),
          col('total', 'decimal'),
          ...cols('currency'),
        ],
      },
      rowActions: [
        act('GET', 'RES.A.invoice_payments', '/sales/invoices/{id}/payments', { showResult: true }),
        act('POST', 'RES.A.record_payment', '/sales/invoices/{id}/payments', {
          fields: RECORD_PAYMENT_FIELDS,
          visible: OPEN_INVOICE,
        }),
        act('GET', 'RES.A.invoice_reminders', '/sales/invoices/{id}/reminders', { showResult: true }),
        act('POST', 'RES.A.send_reminder', '/sales/invoices/{id}/reminders', { confirm: true, visible: OPEN_INVOICE }),
      ],
      toolbar: [
        act('POST', 'RES.A.apply_credit_note', '/invoicing/credit-notes/{credit_note_id}/apply', {
          fields: [
            req(rf.uuid('credit_note_id')),
            req(rf.uuid('target_invoice_id')),
            req(rf.decimal('amount', { positive: true })),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'payment-imports',
      titleKey: 'RES.P.payment_imports',
      module: 'invoicing',
      detailPath: '/sales/payment-imports/{id}',
      list: { path: '/sales/payment-imports', columns: [...cols('file_name'), tagCol('status'), col('created_at', 'datetime')] },
      create: act('POST', 'RES.A.upload_payment_import', '/sales/payment-imports', { fields: [req(rf.file('file'))] }),
      rowActions: [
        act('POST', 'RES.A.match_import_line', '/sales/payment-imports/{id}/lines/{lineId}/match', {
          fields: [req(rf.uuid('lineId', { labelKey: 'RES.F.import_line_id' })), req(rf.uuid('invoice_id'))],
          showResult: true,
        }),
      ],
    },
  ],
};

const DECLARATION_FIELDS = [
  req(rf.lookup('contact_id', 'contacts')),
  rf.select('direction', ['received', 'issued']),
  req(rf.text('protocol_number', { maxLength: 50 })),
  req(rf.date('receipt_date')),
  req(rf.integer('year', { min: 2000, max: 2100 })),
  req(rf.decimal('plafond_amount', { min: 0 })),
  req(rf.date('valid_from')),
  req(rf.date('valid_to', { notBefore: 'valid_from' })),
  rf.textarea('notes'),
];

const CHARGE_BASES = ['per_unit', 'per_kg', 'per_litre', 'percent_of_net'] as const;

const CHARGE_PREVIEW_FIELDS = [
  req(rf.date('date')),
  req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
  req(
    rf.lines(
      'lines',
      [
        rf.uuid('product_id'),
        req(rf.decimal('quantity')),
        req(rf.decimal('unit_price')),
        req(rf.decimal('tax_rate')),
        rf.decimal('discount_percentage'),
      ],
      { required: true },
    ),
  ),
];

/** Italian tax and levy master data of sales: declarations of intent and product charges (eco-contributions). */
export const SALES_TAX_DATA_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SALES_TAX_DATA',
  tabs: [
    {
      id: 'declarations-of-intent',
      titleKey: 'RES.P.declarations_of_intent',
      module: 'invoicing',
      detailPath: '/invoicing/declarations-of-intent/{id}',
      list: {
        path: '/invoicing/declarations-of-intent',
        columns: [
          ...cols('protocol_number', 'contact_id', 'direction', 'year'),
          col('plafond_amount', 'decimal'),
          col('used_amount', 'decimal'),
          col('valid_from', 'date'),
          col('valid_to', 'date'),
        ],
      },
      create: act('POST', 'RES.A.new_declaration_of_intent', '/invoicing/declarations-of-intent', { fields: DECLARATION_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/invoicing/declarations-of-intent/{id}', { prefill: true, fields: DECLARATION_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/invoicing/declarations-of-intent/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'declarations-summary',
      titleKey: 'RES.P.declarations_summary',
      module: 'invoicing',
      list: {
        path: '/invoicing/declarations-of-intent/summary',
        columns: [],
        report: true,
        filters: [rf.integer('year'), rf.lookup('contact_id', 'contacts')],
      },
    },
    {
      id: 'product-charges',
      titleKey: 'RES.P.product_charges',
      module: 'invoicing',
      list: { path: '/invoicing/product-charges', columns: [...cols('code', 'name', 'calculation_basis', 'revenue_account_id')] },
      create: act('POST', 'RES.A.new_product_charge', '/invoicing/product-charges', {
        fields: [
          req(rf.text('code', { maxLength: 50 })),
          req(rf.text('name', { maxLength: 150 })),
          req(rf.select('calculation_basis', CHARGE_BASES)),
          req(rf.uuid('revenue_account_id')),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.add_charge_rate', '/invoicing/product-charges/{id}/rates', {
          fields: [
            req(rf.decimal('rate', { min: 0 })),
            req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
            req(rf.date('valid_from')),
            rf.date('valid_to', { notBefore: 'valid_from' }),
          ],
        }),
        act('POST', 'RES.A.assign_charge_product', '/invoicing/product-charges/{id}/products', {
          fields: [req(rf.uuid('product_id')), rf.decimal('quantity_per_unit', { min: 0 })],
        }),
      ],
      toolbar: [act('POST', 'RES.A.preview_charges', '/invoicing/product-charges/preview', { fields: CHARGE_PREVIEW_FIELDS, showResult: true })],
    },
  ],
};

const PERIOD_FIELDS = [req(rf.date('from')), req(rf.date('to', { notBefore: 'from' })), rf.uuid('sales_representative_id')];

/** Sales teams, targets and agent commissions. */
export const SALES_COMMISSIONS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SALES_COMMISSIONS',
  tabs: [
    {
      id: 'commission-statements',
      titleKey: 'RES.P.commission_statements',
      module: 'invoicing',
      list: {
        path: '/invoicing/commission-statements',
        columns: [...cols('sales_representative_id'), col('from', 'date'), col('to', 'date'), col('total_amount', 'decimal'), tagCol('status')],
      },
      create: act('POST', 'RES.A.new_commission_statement', '/invoicing/commission-statements', { fields: PERIOD_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.approve', '/invoicing/commission-statements/{id}/approve', { confirm: true, visible: whenIn('status', 'draft') }),
        act('POST', 'RES.A.post_to_ledger', '/invoicing/commission-statements/{id}/post', { confirm: true, visible: whenIn('status', 'approved') }),
        act('POST', 'RES.A.mark_paid', '/invoicing/commission-statements/{id}/paid', { confirm: true, visible: whenIn('status', 'posted') }),
      ],
      toolbar: [
        act('POST', 'RES.A.accrue_commissions', '/invoicing/commissions/accrue', { fields: PERIOD_FIELDS, showResult: true }),
        act('PUT', 'RES.A.commission_settings', '/invoicing/commission-settings', {
          fields: [req(rf.uuid('expense_account_id')), req(rf.uuid('payable_account_id'))],
        }),
      ],
    },
    {
      id: 'sales-targets',
      titleKey: 'RES.P.sales_targets',
      module: 'invoicing',
      list: {
        path: '/invoicing/sales-targets/attainment',
        columns: [],
        report: true,
        manual: true,
        filters: [req(rf.date('from')), req(rf.date('to', { notBefore: 'from' })), rf.uuid('sales_representative_id')],
      },
      toolbar: [
        act('POST', 'RES.A.new_sales_target', '/invoicing/sales-targets', {
          fields: [
            rf.uuid('sales_representative_id'),
            rf.uuid('sales_team_id'),
            req(rf.date('period_start')),
            req(rf.date('period_end', { notBefore: 'period_start' })),
            req(rf.decimal('target_amount', { min: 0 })),
            req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
          ],
        }),
        act('POST', 'RES.A.new_sales_team', '/invoicing/sales-teams', {
          fields: [req(rf.text('name', { maxLength: 150 })), rf.tags('sales_representative_ids')],
        }),
      ],
    },
  ],
};
