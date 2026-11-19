import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const KINDS = ['customer', 'supplier'] as const;
const STATUSES = ['draft', 'active', 'expired', 'terminated', 'renewed'] as const;
const OBLIGATION_STATUSES = ['open', 'completed', 'waived'] as const;

/** Contract terms, status transitions and obligations of the register (API: /contract-register). */
export const CONTRACT_OPERATIONS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CONTRACT_OPERATIONS',
  tabs: [
    {
      id: 'contract-terms',
      titleKey: 'RES.P.contract_terms',
      module: 'contracts',
      list: {
        path: '/contract-register',
        filters: [rf.text('search'), rf.select('kind', KINDS), rf.select('status', STATUSES)],
        columns: [...cols('contract_number', 'title', 'counterparty_name', 'kind'), tagCol('status'), col('end_date', 'date')],
      },
      rowActions: [
        act('PUT', 'RES.A.edit_contract_terms', '/contract-register/{kind}/{id}/terms', {
          prefill: true,
          fields: [
            rf.integer('notice_period_days', { min: 0, max: 3650 }),
            rf.bool('auto_renew'),
            rf.integer('renewal_term_months', { min: 1, max: 120 }),
            rf.integer('alert_days_before', { min: 0, max: 365 }),
          ],
        }),
        act('POST', 'RES.A.transition_contract', '/contract-register/{kind}/{id}/transition', {
          fields: [req(rf.select('status', STATUSES)), rf.textarea('reason', { maxLength: 1000 })],
          visible: whenIn('status', 'draft', 'active'),
        }),
      ],
    },
    {
      id: 'contract-obligations',
      titleKey: 'RES.P.contract_obligations',
      module: 'contracts',
      list: {
        path: '/contract-register/obligations',
        filters: [rf.select('status', OBLIGATION_STATUSES), rf.select('contract_kind', KINDS)],
        columns: [...cols('title', 'type', 'contract_kind'), col('due_date', 'date'), tagCol('status')],
      },
      rowActions: [
        act('DELETE', 'RES.A.delete_contract_obligation', '/contract-register/obligations/{id}', {
          confirm: true,
          danger: true,
          visible: whenIn('status', 'open'),
        }),
      ],
    },
  ],
};
