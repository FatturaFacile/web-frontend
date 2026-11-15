import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const CLAUSE_STATUSES = ['draft', 'approved', 'retired'] as const;
const SIGNATURE_ORDERS = ['sequential', 'parallel'] as const;
const ROUND_OUTCOMES = ['agreed', 'countered', 'rejected', 'withdrawn'] as const;

/** Clause library, contract templates, redlining and e-signature of the contract register (API: /contract-authoring). */
export const CONTRACT_AUTHORING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CONTRACT_AUTHORING',
  tabs: [
    {
      id: 'contract-clauses',
      titleKey: 'RES.P.contract_clauses',
      module: 'contracts',
      list: {
        path: '/contract-authoring/clauses',
        filters: [rf.text('q'), rf.select('status', CLAUSE_STATUSES)],
        columns: [...cols('code', 'title', 'category'), tagCol('status'), col('current_version_no')],
      },
      create: act('POST', 'RES.A.new_contract_clause', '/contract-authoring/clauses', {
        fields: [req(rf.text('code')), req(rf.text('title')), rf.text('category'), req(rf.textarea('body')), rf.text('change_note')],
      }),
      rowActions: [
        act('GET', 'RES.A.view_contract_clause', '/contract-authoring/clauses/{id}', { showResult: true }),
        act('POST', 'RES.A.add_clause_version', '/contract-authoring/clauses/{id}/versions', {
          fields: [req(rf.textarea('body')), rf.text('change_note')],
          visible: whenIn('status', 'draft', 'approved'),
        }),
        act('POST', 'RES.A.set_clause_status', '/contract-authoring/clauses/{id}/status', {
          fields: [req(rf.select('status', CLAUSE_STATUSES))],
          visible: whenIn('status', 'draft', 'approved'),
        }),
        act('POST', 'RES.A.add_clause_fallback', '/contract-authoring/clauses/{id}/fallbacks', {
          fields: [req(rf.text('title')), req(rf.textarea('body')), rf.integer('rank'), rf.bool('requires_approval')],
          visible: whenIn('status', 'draft', 'approved'),
        }),
      ],
    },
    {
      id: 'contract-templates',
      titleKey: 'RES.P.contract_templates',
      module: 'contracts',
      list: {
        path: '/contract-authoring/templates',
        filters: [rf.select('status', ['draft', 'active', 'archived']), rf.select('contract_kind', ['customer', 'supplier'])],
        columns: [...cols('name', 'contract_kind'), tagCol('status')],
      },
      create: act('POST', 'RES.A.new_contract_template', '/contract-authoring/templates', {
        fields: [
          req(rf.text('name')),
          rf.select('contract_kind', ['customer', 'supplier']),
          rf.select('status', ['draft', 'active', 'archived']),
          rf.lines('variables', [req(rf.text('key')), rf.text('label'), rf.bool('required'), rf.text('default')]),
          rf.lines('clauses', [req(rf.uuid('clause_id')), rf.bool('is_optional')], { required: true }),
        ],
      }),
      rowActions: [
        act('GET', 'RES.A.view_contract_template', '/contract-authoring/templates/{id}', { showResult: true }),
        act('POST', 'RES.A.preview_contract_template', '/contract-authoring/templates/{id}/preview', {
          fields: [rf.json('variables'), rf.multiselect('include_optional', [])],
          showResult: true,
        }),
        act('DELETE', 'RES.A.delete_contract_template', '/contract-authoring/templates/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'contract-redlining',
      titleKey: 'RES.P.contract_redlining',
      module: 'contracts',
      list: {
        path: '/contract-register',
        filters: [rf.text('search'), rf.select('kind', ['customer', 'supplier'])],
        columns: [...cols('contract_number', 'title', 'counterparty_name', 'kind'), tagCol('status')],
      },
      rowActions: [
        act('GET', 'RES.A.list_text_versions', '/contract-authoring/contracts/{kind}/{id}/versions', { showResult: true }),
        act('POST', 'RES.A.add_text_version', '/contract-authoring/contracts/{kind}/{id}/versions', {
          fields: [req(rf.textarea('body')), rf.select('source', ['edit', 'counterparty']), rf.text('notes')],
        }),
        act('POST', 'RES.A.assemble_from_template', '/contract-authoring/contracts/{kind}/{id}/versions/from-template', {
          fields: [req(rf.uuid('template_id')), rf.json('variables')],
        }),
        act('GET', 'RES.A.compare_text_versions', '/contract-authoring/contracts/{kind}/{id}/versions/compare', {
          fields: [req(rf.integer('from')), req(rf.integer('to'))],
          showResult: true,
        }),
        act('GET', 'RES.A.list_negotiation_rounds', '/contract-authoring/contracts/{kind}/{id}/rounds', { showResult: true }),
        act('POST', 'RES.A.open_negotiation_round', '/contract-authoring/contracts/{kind}/{id}/rounds', { fields: [rf.textarea('summary')] }),
        act('POST', 'RES.A.close_negotiation_round', '/contract-authoring/negotiation-rounds/{roundId}/close', {
          fields: [req(rf.uuid('roundId', { labelKey: 'RES.F.round_id' })), req(rf.select('outcome', ROUND_OUTCOMES)), rf.textarea('summary')],
        }),
      ],
    },
    {
      id: 'contract-signatures',
      titleKey: 'RES.P.contract_signatures',
      module: 'contracts',
      list: {
        path: '/contract-register',
        filters: [rf.text('search'), rf.select('kind', ['customer', 'supplier'])],
        columns: [...cols('contract_number', 'title', 'counterparty_name', 'kind'), tagCol('status')],
      },
      rowActions: [
        act('GET', 'RES.A.list_signature_requests', '/contract-authoring/contracts/{kind}/{id}/signature-requests', { showResult: true }),
        act('POST', 'RES.A.new_signature_request', '/contract-authoring/contracts/{kind}/{id}/signature-requests', {
          fields: [
            req(rf.uuid('document_version_id')),
            rf.select('order_mode', SIGNATURE_ORDERS),
            rf.date('expires_on'),
            rf.lines('signers', [req(rf.text('name')), req(rf.text('email'))], { required: true }),
          ],
        }),
        act('GET', 'RES.A.view_signature_request', '/contract-authoring/signature-requests/{requestId}', {
          fields: [req(rf.uuid('requestId', { labelKey: 'RES.F.request_id' }))],
          showResult: true,
        }),
        act('POST', 'RES.A.send_signature_request', '/contract-authoring/signature-requests/{requestId}/send', {
          fields: [req(rf.uuid('requestId', { labelKey: 'RES.F.request_id' }))],
          showResult: true,
        }),
        act('POST', 'RES.A.sign_signature_request', '/contract-authoring/signature-requests/{requestId}/sign', {
          fields: [req(rf.uuid('requestId', { labelKey: 'RES.F.request_id' })), req(rf.text('token'))],
        }),
        act('POST', 'RES.A.cancel_signature_request', '/contract-authoring/signature-requests/{requestId}/cancel', {
          fields: [req(rf.uuid('requestId', { labelKey: 'RES.F.request_id' }))],
          confirm: true,
          danger: true,
        }),
      ],
    },
  ],
};
