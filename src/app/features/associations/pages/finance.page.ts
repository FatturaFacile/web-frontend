import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol, whenIn } from '@shared';

const MODULE = 'associations';

const YEAR_FILTER = [rf.integer('year', { min: 2000 })];
const YEAR_SCOPE = req(rf.text('year', { maxLength: 4 }));
const PAYMENT_METHODS = ['cash', 'bank'] as const;

/** Instalments of the fees: payment links and the reversal of a payment. */
const INSTALMENTS_PANEL: ResourcePanelConfig = {
  id: 'instalments',
  titleKey: 'RES.P.assoc_instalments',
  module: MODULE,
  list: {
    path: '/associations/instalments',
    columns: [...cols('fee_assignment_id', 'sequence'), col('due_on', 'date'), col('amount', 'decimal'), col('paid_amount', 'decimal'), tagCol('status')],
  },
  toolbar: [
    act('POST', 'RES.A.reverse_payment', '/associations/fee-payments/{fee_payment_id}/reverse', {
      fields: [req(rf.uuid('fee_payment_id')), req(rf.text('reason', { maxLength: 255 })), rf.date('reversed_on', { notInFuture: true })],
      danger: true,
    }),
  ],
  rowActions: [
    act('POST', 'RES.A.payment_link', '/associations/instalments/{id}/payment-link', {
      showResult: true,
      visible: (row) => row['status'] !== 'paid',
    }),
  ],
};

/** Receipts issued to the members, with the PDF. */
const RECEIPTS_PANEL: ResourcePanelConfig = {
  id: 'receipts',
  titleKey: 'RES.P.assoc_receipts',
  module: MODULE,
  list: {
    path: '/associations/receipts',
    filters: [rf.integer('fiscal_year', { min: 2000 })],
    columns: [...cols('number'), col('fiscal_year'), tagCol('kind'), col('issued_on', 'date'), col('amount', 'decimal'), ...cols('description')],
  },
  rowActions: [act('GET', 'RES.A.download_pdf', '/associations/receipts/{id}/pdf', { download: true })],
};

export const ASSOC_FEES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_FEES',
  tabs: [INSTALMENTS_PANEL, RECEIPTS_PANEL],
};

const SPORT_EXPORT_FIELDS = [YEAR_SCOPE];

/** Amateur sport work: compensations, contract documents, thresholds, single book and exports. */
const COMPENSATIONS_PANEL: ResourcePanelConfig = {
  id: 'sport-compensations',
  titleKey: 'RES.P.assoc_sport_compensations',
  module: MODULE,
  list: {
    path: '/associations/sport/compensations',
    filters: YEAR_FILTER,
    columns: [...cols('collaborator_id', 'period'), col('paid_on', 'date'), col('gross_amount', 'decimal'), col('contribution_amount', 'decimal'), col('withholding_amount', 'decimal')],
  },
  create: act('POST', 'RES.A.new_compensation', '/associations/sport/compensations', {
    fields: [
      req(rf.uuid('collaborator_id')),
      rf.uuid('contract_id'),
      req(rf.text('period', { maxLength: 7 })),
      req(rf.date('paid_on')),
      req(rf.decimal('gross_amount')),
      rf.decimal('contribution_base'),
      rf.decimal('contribution_amount'),
      rf.decimal('withholding_base'),
      rf.decimal('withholding_amount'),
      rf.decimal('hours'),
      rf.select('payment_method', PAYMENT_METHODS),
      rf.textarea('notes', { maxLength: 2000 }),
    ],
  }),
  toolbar: [
    act('POST', 'RES.A.upload_contract_document', '/associations/sport-contracts/{contract_id}/document', {
      fields: [req(rf.uuid('contract_id')), req(rf.file('file'))],
    }),
    act('GET', 'RES.A.download_contract_document', '/associations/sport-contracts/{contract_id}/document', {
      fields: [req(rf.uuid('contract_id'))],
      download: true,
    }),
  ],
};

const SPORT_EXPIRIES_PANEL: ResourcePanelConfig = {
  id: 'sport-expiries',
  titleKey: 'RES.P.assoc_sport_expiries',
  module: MODULE,
  list: { path: '/associations/sport/expiries', report: true, filters: [rf.integer('days', { min: 1 })], columns: [] },
};

const SPORT_THRESHOLDS_PANEL: ResourcePanelConfig = {
  id: 'sport-thresholds',
  titleKey: 'RES.P.assoc_sport_thresholds',
  module: MODULE,
  list: { path: '/associations/sport/{year}/thresholds', report: true, scope: YEAR_SCOPE, columns: [] },
};

const SPORT_BOOK_PANEL: ResourcePanelConfig = {
  id: 'sport-single-book',
  titleKey: 'RES.P.assoc_sport_single_book',
  module: MODULE,
  list: { path: '/associations/sport/{year}/single-book', report: true, scope: YEAR_SCOPE, columns: [] },
  toolbar: [
    act('GET', 'RES.A.single_book_csv', '/associations/sport/{year}/single-book/csv', { fields: SPORT_EXPORT_FIELDS, download: true }),
    act('GET', 'RES.A.accountant_csv', '/associations/sport/{year}/accountant-csv', { fields: SPORT_EXPORT_FIELDS, download: true }),
    act('GET', 'RES.A.registry_csv', '/associations/sport/{year}/registry-csv', { fields: SPORT_EXPORT_FIELDS, download: true }),
  ],
};

export const ASSOC_SPORT_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_SPORT',
  tabs: [COMPENSATIONS_PANEL, SPORT_EXPIRIES_PANEL, SPORT_THRESHOLDS_PANEL, SPORT_BOOK_PANEL],
};

/** Donations, receipts, campaigns, sponsor contracts and reimbursements of the volunteers. */
const DONATIONS_PANEL: ResourcePanelConfig = {
  id: 'donations',
  titleKey: 'RES.P.assoc_donations',
  module: MODULE,
  list: {
    path: '/associations/donations',
    filters: YEAR_FILTER,
    columns: [...cols('donor_id', 'campaign_id'), tagCol('kind'), col('amount', 'decimal'), col('received_on', 'date'), tagCol('status')],
  },
  toolbar: [
    act('GET', 'RES.A.download_pdf', '/associations/donation-receipts/{receipt_id}/pdf', {
      fields: [req(rf.uuid('receipt_id'))],
      download: true,
    }),
    act('POST', 'RES.A.cancel_receipt', '/associations/donation-receipts/{receipt_id}/cancel', {
      fields: [req(rf.uuid('receipt_id')), req(rf.text('reason', { maxLength: 500 }))],
      danger: true,
    }),
  ],
};

const CAMPAIGN_SCOPE = req(rf.text('campaign_id'));

const CAMPAIGNS_PANEL: ResourcePanelConfig = {
  id: 'campaigns',
  titleKey: 'RES.P.assoc_campaigns',
  module: MODULE,
  list: { path: '/associations/campaigns/{campaign_id}/report', report: true, scope: CAMPAIGN_SCOPE, columns: [] },
  toolbar: [
    act('POST', 'RES.A.add_campaign_expense', '/associations/campaigns/{campaign_id}/expenses', {
      fields: [
        req(rf.uuid('campaign_id')),
        req(rf.date('incurred_on')),
        req(rf.text('description', { maxLength: 500 })),
        req(rf.decimal('amount')),
        rf.uuid('expense_account_id'),
        rf.select('payment_method', PAYMENT_METHODS),
        rf.uuid('category_id'),
      ],
    }),
    act('POST', 'RES.A.upload_sponsor_document', '/associations/sponsor-contracts/{contract_id}/document', {
      fields: [req(rf.uuid('contract_id')), req(rf.file('file'))],
    }),
    act('GET', 'RES.A.download_sponsor_document', '/associations/sponsor-contracts/{contract_id}/document', {
      fields: [req(rf.uuid('contract_id'))],
      download: true,
    }),
  ],
};

const REIMBURSEMENTS_PANEL: ResourcePanelConfig = {
  id: 'reimbursements',
  titleKey: 'RES.P.assoc_reimbursements',
  module: MODULE,
  list: {
    path: '/associations/reimbursements',
    filters: YEAR_FILTER,
    columns: [tagCol('kind'), col('incurred_on', 'date'), ...cols('description'), col('amount', 'decimal'), tagCol('status')],
  },
  toolbar: [
    act('GET', 'RES.A.download_attachment', '/associations/reimbursement-attachments/{attachment_id}/download', {
      fields: [req(rf.uuid('attachment_id'))],
      download: true,
    }),
  ],
  rowActions: [
    act('POST', 'RES.A.add_attachment', '/associations/reimbursements/{id}/attachments', {
      fields: [req(rf.file('file'))],
      visible: whenIn('status', 'submitted', 'approved'),
    }),
  ],
};

export const ASSOC_FUNDRAISING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_FUNDRAISING',
  tabs: [DONATIONS_PANEL, CAMPAIGNS_PANEL, REIMBURSEMENTS_PANEL],
};

const SETTINGS_FIELDS = [
  rf.text('card_prefix', { maxLength: 20 }),
  rf.integer('card_padding', { min: 0 }),
  rf.text('receipt_prefix', { maxLength: 20 }),
  rf.select('default_receipt_kind', ['simple', 'full']),
  rf.json('fee_reminder_days'),
  rf.json('renewal_reminder_days'),
  rf.integer('certificate_alert_days', { min: 0 }),
  rf.integer('presence_max_hours', { min: 1 }),
  rf.bool('ledger_enabled'),
  rf.uuid('default_revenue_account_id'),
  rf.integer('max_proxies_per_holder', { min: 0 }),
  rf.uuid('reimbursement_account_id'),
  rf.integer('shift_alert_days', { min: 0 }),
  rf.integer('volunteer_expiry_alert_days', { min: 0 }),
  rf.text('donation_receipt_prefix', { maxLength: 20 }),
  rf.uuid('donation_revenue_account_id'),
  rf.uuid('five_per_mille_revenue_account_id'),
  rf.bool('lex398_enabled'),
  rf.date('lex398_since'),
];

/** Association settings, section report and the searchable archive of the books. */
const SETTINGS_PANEL: ResourcePanelConfig = {
  id: 'settings',
  titleKey: 'RES.P.assoc_settings',
  module: MODULE,
  list: { path: '/associations/settings', report: true, columns: [] },
  toolbar: [act('PUT', 'RES.ACTION.EDIT', '/associations/settings', { prefill: true, fields: SETTINGS_FIELDS })],
};

const SECTIONS_PANEL: ResourcePanelConfig = {
  id: 'sections-report',
  titleKey: 'RES.P.assoc_sections_report',
  module: MODULE,
  list: { path: '/associations/sections/{year}/report', report: true, scope: YEAR_SCOPE, columns: [] },
};

const ARCHIVE_PANEL: ResourcePanelConfig = {
  id: 'archive',
  titleKey: 'RES.P.assoc_archive',
  module: MODULE,
  list: {
    path: '/associations/archive',
    filters: [rf.text('q'), rf.date('from'), rf.date('to'), rf.select('body', ['assembly', 'board', 'other']), rf.uuid('member_id')],
    columns: [tagCol('type'), col('date', 'date'), ...cols('title', 'reference')],
  },
};

export const ASSOC_SETTINGS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_SETTINGS',
  tabs: [SETTINGS_PANEL, SECTIONS_PANEL, ARCHIVE_PANEL],
};
