import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const CLASSES = ['issued_invoice', 'received_invoice', 'ledger_book', 'payslip', 'contract'] as const;

/** Preservation packages (sealing, verification, export), their settings, access log and the disposal workflow. */
export const PRESERVATION_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.DOCUMENT_PRESERVATION',
  tabs: [
    {
      id: 'packages',
      titleKey: 'RES.P.preservation_packages',
      module: 'document_trust',
      list: {
        path: '/document-trust/preservation-packages',
        filters: [rf.select('document_class', CLASSES), rf.select('status', ['open', 'closed'])],
        columns: [...cols('name'), tagCol('document_class'), tagCol('status'), col('items_count'), col('retention_until', 'date')],
      },
      detailPath: '/document-trust/preservation-packages/{id}',
      create: act('POST', 'RES.A.preservation_new_package', '/document-trust/preservation-packages', {
        fields: [req(rf.select('document_class', CLASSES)), req(rf.text('name', { maxLength: 190 })), rf.date('period_from'), rf.date('period_to')],
      }),
      rowActions: [
        act('POST', 'RES.A.preservation_add_item', '/document-trust/preservation-packages/{id}/items', {
          fields: [
            req(rf.uuid('source_id')),
            rf.date('document_date'),
            rf.text('document_number', { maxLength: 190 }),
            rf.text('counterpart_name', { maxLength: 190 }),
            rf.text('counterpart_vat_number', { maxLength: 40 }),
          ],
          visible: whenIn('status', 'open'),
        }),
        act('DELETE', 'RES.A.preservation_remove_item', '/document-trust/preservation-packages/{id}/items/{item_id}', {
          fields: [req(rf.uuid('item_id'))],
          confirm: true,
          danger: true,
          visible: whenIn('status', 'open'),
        }),
        act('POST', 'RES.A.preservation_close_package', '/document-trust/preservation-packages/{id}/close', {
          confirm: true,
          visible: whenIn('status', 'open'),
        }),
        act('POST', 'RES.A.preservation_verify_package', '/document-trust/preservation-packages/{id}/verify', { showResult: true }),
        act('GET', 'RES.A.preservation_export_package', '/document-trust/preservation-packages/{id}/export', { download: true }),
        act('POST', 'RES.A.preservation_legal_hold', '/document-trust/preservation-packages/{id}/legal-hold', {
          fields: [req(rf.textarea('reason', { maxLength: 2000 }))],
        }),
        act('DELETE', 'RES.A.preservation_release_hold', '/document-trust/preservation-packages/{id}/legal-hold', { confirm: true }),
        act('DELETE', 'RES.A.preservation_delete_package', '/document-trust/preservation-packages/{id}', {
          confirm: true,
          danger: true,
          visible: whenIn('status', 'open'),
        }),
      ],
      toolbar: [
        act('POST', 'RES.A.preservation_seal_journal_book', '/document-trust/preservation-seal/journal-book', {
          fields: [req(rf.uuid('fiscal_year_id')), rf.date('from'), rf.date('to'), rf.uuid('folder_id'), rf.uuid('package_id')],
          showResult: true,
        }),
        act('POST', 'RES.A.preservation_seal_payslips', '/document-trust/preservation-seal/payslips', {
          fields: [req(rf.integer('year', { min: 2000 })), req(rf.integer('month', { min: 1, max: 12 })), rf.uuid('folder_id'), rf.uuid('package_id')],
          showResult: true,
        }),
      ],
    },
    {
      id: 'items',
      titleKey: 'RES.P.preservation_items',
      module: 'document_trust',
      list: {
        path: '/document-trust/preservation-items',
        filters: [
          rf.select('document_class', CLASSES),
          rf.text('number'),
          rf.text('counterpart'),
          rf.text('vat_number'),
          rf.date('date_from'),
          rf.date('date_to'),
          rf.text('sha256'),
        ],
        columns: [...cols('sequence', 'file_name', 'document_number', 'counterpart_name'), tagCol('document_class'), col('document_date', 'date')],
      },
    },
    {
      id: 'settings',
      titleKey: 'RES.P.preservation_settings',
      module: 'document_trust',
      list: { path: '/document-trust/preservation-settings', columns: [], report: true },
      toolbar: [
        act('PUT', 'RES.A.preservation_edit_settings', '/document-trust/preservation-settings', {
          fields: [rf.json('retention_years'), rf.bool('confirmed_by_accountant'), rf.textarea('notes', { maxLength: 2000 })],
        }),
      ],
    },
    {
      id: 'access-logs',
      titleKey: 'RES.P.preservation_access_logs',
      module: 'document_trust',
      list: {
        path: '/document-trust/preservation-access-logs',
        filters: [rf.uuid('package_id'), rf.text('action')],
        columns: [...cols('action', 'package_id', 'user_id'), col('created_at', 'datetime')],
      },
    },
    {
      id: 'disposal-candidates',
      titleKey: 'RES.P.preservation_disposal_candidates',
      module: 'document_trust',
      list: {
        path: '/document-trust/preservation-disposal-candidates',
        columns: [...cols('name'), tagCol('document_class'), col('items_count'), col('expiry_date', 'date'), col('eligible', 'bool')],
      },
      rowActions: [
        act('POST', 'RES.A.preservation_propose_disposal', '/document-trust/preservation-disposal-proposals', {
          fields: [req(rf.uuid('package_id')), rf.textarea('note', { maxLength: 2000 })],
          prefill: true,
          visible: (row) => row['eligible'] === true,
        }),
      ],
    },
    {
      id: 'disposal-proposals',
      titleKey: 'RES.P.preservation_disposal_proposals',
      module: 'document_trust',
      list: {
        path: '/document-trust/preservation-disposal-proposals',
        filters: [rf.select('status', ['proposed', 'approved', 'rejected', 'executed'])],
        columns: [...cols('package_id'), tagCol('status'), col('expiry_date', 'date'), col('proposed_at', 'datetime')],
      },
      rowActions: [
        act('POST', 'RES.A.preservation_approve_disposal', '/document-trust/preservation-disposal-proposals/{id}/approve', {
          fields: [rf.textarea('note', { maxLength: 2000 })],
          visible: whenIn('status', 'proposed'),
        }),
        act('POST', 'RES.A.preservation_reject_disposal', '/document-trust/preservation-disposal-proposals/{id}/reject', {
          fields: [rf.textarea('note', { maxLength: 2000 })],
          danger: true,
          visible: whenIn('status', 'proposed'),
        }),
        act('POST', 'RES.A.preservation_execute_disposal', '/document-trust/preservation-disposal-proposals/{id}/execute', {
          confirm: true,
          danger: true,
          visible: whenIn('status', 'approved'),
        }),
      ],
    },
    {
      id: 'edocument-transmissions',
      titleKey: 'RES.P.edocument_transmissions',
      module: 'document_trust',
      list: {
        path: '/edocument-networks/transmissions',
        columns: [...cols('network', 'reference'), tagCol('status'), col('created_at', 'datetime')],
      },
      toolbar: [
        act('GET', 'RES.A.peppol_download_ubl', '/edocument-networks/peppol/invoices/{invoice_id}/ubl', {
          fields: [req(rf.uuid('invoice_id'))],
          download: true,
        }),
      ],
    },
    {
      id: 'disposals',
      titleKey: 'RES.P.preservation_disposals',
      module: 'document_trust',
      list: {
        path: '/document-trust/preservation-disposals',
        columns: [...cols('package_name', 'items_count', 'manifest_sha256'), tagCol('document_class'), col('expiry_date', 'date')],
      },
    },
  ],
};
