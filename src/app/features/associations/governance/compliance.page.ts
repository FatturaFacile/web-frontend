import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';
import { yearScope } from './scopes';

const DIRECTIONS = ['incoming', 'outgoing', 'internal'] as const;
const BOOKS = ['members', 'volunteers', 'meetings', 'protocol'] as const;

const bookScope = () => rf.select('book', BOOKS, { labelKey: 'RES.F.book' });

const PROTOCOL_FIELDS = [
  req(rf.select('direction', DIRECTIONS)),
  rf.date('registered_on'),
  rf.date('document_date'),
  req(rf.text('correspondent', { maxLength: 500 })),
  req(rf.text('subject', { maxLength: 255 })),
  rf.text('category', { maxLength: 100 }),
  rf.uuid('meeting_id'),
  rf.file('file'),
];

const LEX398_ENTRY_FIELDS = [
  req(rf.date('entry_date')),
  req(rf.text('document_number', { maxLength: 60 })),
  rf.text('counterparty', { maxLength: 255 }),
  rf.text('description', { maxLength: 500 }),
  req(rf.decimal('taxable_amount')),
  rf.decimal('vat_rate'),
  rf.decimal('vat_amount'),
];

const EXPENSE_FIELDS = [
  req(rf.date('incurred_on')),
  req(rf.text('description', { maxLength: 255 })),
  req(rf.decimal('amount')),
  rf.select('payment_method', ['cash', 'bank']),
  rf.uuid('category_id'),
  rf.uuid('expense_account_id'),
];

const IMPORT_ID = [req(rf.uuid('id', { labelKey: 'RES.F.import_id' }))];

/** Compliance of the association: legal books, protocol, 5 per mille, art. 398 regime and registry imports. */
export const ASSOCIATIONS_COMPLIANCE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_COMPLIANCE',
  tabs: [
    {
      id: 'books',
      titleKey: 'RES.P.assoc_books',
      module: 'associations',
      list: { path: '/associations/books/{book}', columns: [], report: true, scope: bookScope() },
      toolbar: [
        act('GET', 'RES.A.assoc_book_csv', '/associations/books/{book}/csv', { fields: [req(bookScope())], download: true }),
        act('GET', 'RES.A.assoc_book_pdf', '/associations/books/{book}/pdf', { fields: [req(bookScope())], download: true }),
      ],
    },
    {
      id: 'protocol',
      titleKey: 'RES.P.assoc_protocol',
      module: 'associations',
      list: {
        path: '/associations/protocol',
        columns: [...cols('number'), tagCol('direction'), col('registered_on', 'date'), ...cols('correspondent', 'subject', 'category'), col('cancelled_at', 'datetime')],
      },
      create: act('POST', 'RES.A.assoc_register_protocol', '/associations/protocol', { fields: PROTOCOL_FIELDS }),
      rowActions: [
        act('GET', 'RES.A.assoc_protocol_download', '/associations/protocol/{id}/download', { download: true }),
        act('POST', 'RES.A.assoc_cancel_protocol', '/associations/protocol/{id}/cancel', {
          fields: [req(rf.text('reason', { maxLength: 500 }))],
          danger: true,
          visible: (row) => !row['cancelled_at'],
        }),
      ],
    },
    {
      id: 'five-per-mille',
      titleKey: 'RES.P.assoc_five_per_mille',
      module: 'associations',
      list: {
        path: '/associations/five-per-mille',
        columns: [...cols('reference_year'), col('received_on', 'date'), ...cols('amount', 'payment_method', 'notes')],
      },
      rowActions: [
        act('POST', 'RES.A.assoc_add_expense', '/associations/five-per-mille/{id}/expenses', { fields: EXPENSE_FIELDS }),
        act('GET', 'RES.A.assoc_five_per_mille_report', '/associations/five-per-mille/{id}/report', { showResult: true }),
        act('GET', 'RES.A.assoc_five_per_mille_csv', '/associations/five-per-mille/{id}/csv', { download: true }),
      ],
    },
    {
      id: 'lex398-monitor',
      titleKey: 'RES.P.assoc_lex398_monitor',
      module: 'associations',
      list: { path: '/associations/lex398/{year}/monitor', columns: [], report: true, scope: yearScope() },
    },
    {
      id: 'lex398-register',
      titleKey: 'RES.P.assoc_lex398_register',
      module: 'associations',
      list: { path: '/associations/lex398/{year}/register', columns: [], report: true, scope: yearScope() },
      toolbar: [
        act('POST', 'RES.A.assoc_lex398_entry', '/associations/lex398/entries', { fields: LEX398_ENTRY_FIELDS }),
        act('POST', 'RES.A.assoc_lex398_sync', '/associations/lex398/{year}/sync-invoices', {
          fields: [req(yearScope())],
          showResult: true,
        }),
        act('GET', 'RES.A.assoc_lex398_csv', '/associations/lex398/{year}/register/csv', {
          fields: [req(yearScope())],
          download: true,
        }),
      ],
    },
    {
      id: 'registry-imports',
      titleKey: 'RES.P.assoc_registry_imports',
      module: 'associations',
      list: { path: '', columns: [] },
      toolbar: [
        act('POST', 'RES.A.assoc_import_preview', '/associations/registry-imports', { fields: [req(rf.file('file'))], showResult: true }),
        act('GET', 'RES.A.assoc_import_view', '/associations/registry-imports/{id}', { fields: IMPORT_ID, showResult: true }),
        act('POST', 'RES.A.assoc_import_commit', '/associations/registry-imports/{id}/commit', {
          fields: [...IMPORT_ID, rf.select('on_duplicate', ['skip', 'update'])],
          showResult: true,
        }),
      ],
    },
  ],
};

/** Affiliation network of the association: code, consents, figures and the statements of the affiliates. */
export const ASSOCIATIONS_NETWORK_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_NETWORK',
  tabs: [
    {
      id: 'network-code',
      titleKey: 'RES.P.assoc_network_code',
      module: 'associations',
      list: { path: '/associations/network/code', columns: [], report: true },
      toolbar: [
        act('POST', 'RES.A.assoc_request_affiliation', '/associations/network/affiliates', {
          fields: [req(rf.text('affiliation_code'))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'network-consents',
      titleKey: 'RES.P.assoc_network_consents',
      module: 'associations',
      list: {
        path: '/associations/network/consents',
        columns: [...cols('parent_tenant_id'), tagCol('status'), col('requested_at', 'datetime'), col('consent_granted_at', 'datetime'), col('consent_withdrawn_at', 'datetime')],
      },
      rowActions: [
        act('POST', 'RES.A.assoc_grant_consent', '/associations/network/consents/{id}/grant', {
          confirm: true,
          visible: (row) => row['status'] === 'pending',
        }),
        act('POST', 'RES.A.assoc_withdraw_network_consent', '/associations/network/consents/{id}/withdraw', {
          confirm: true,
          danger: true,
          visible: (row) => row['status'] === 'active',
        }),
      ],
    },
    {
      id: 'network-figures',
      titleKey: 'RES.P.assoc_network_figures',
      module: 'associations',
      list: { path: '/associations/network/figures', columns: [], report: true },
    },
    {
      id: 'network-statements',
      titleKey: 'RES.P.assoc_network_statements',
      module: 'associations',
      list: { path: '/associations/network/statements/{year}', columns: [], report: true, scope: yearScope() },
    },
  ],
};
