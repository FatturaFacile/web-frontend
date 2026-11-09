import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const PERIOD_FILTERS = [rf.date('from'), rf.date('to'), rf.select('dimension', ['supplier', 'category', 'cost_center'])];

const SETTINGS_FIELDS = [
  rf.decimal('over_receipt_tolerance_percent'),
  rf.decimal('under_receipt_tolerance_percent'),
  rf.decimal('price_tolerance_percent'),
  rf.decimal('price_tolerance_amount'),
  rf.bool('block_invoice_on_mismatch'),
  rf.text('landed_cost_clearing_account_code'),
];

/** Tolerances, approval matrices, analytics and supplier invoice approval. */
export const PROCUREMENT_ADMIN_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PROCUREMENT_ADMIN',
  tabs: [
    {
      id: 'settings',
      titleKey: 'RES.P.procurement_settings',
      module: 'procurement',
      list: { path: '/procurement/settings', report: true, columns: [] },
      toolbar: [act('PUT', 'RES.A.edit_settings', '/procurement/settings', { prefill: true, fields: SETTINGS_FIELDS })],
    },
    {
      id: 'approval-matrices',
      titleKey: 'RES.P.approval_matrices',
      module: 'procurement',
      list: { path: '/procurement/approval-matrices', columns: [...cols('name'), tagCol('target'), ...cols('cost_center_id'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_matrix', '/procurement/approval-matrices', {
        fields: [
          req(rf.select('target', ['purchase_order', 'purchase_requisition'])),
          req(rf.text('name')),
          rf.uuid('cost_center_id'),
          req(
            rf.lines(
              'tiers',
              [
                req(rf.integer('tier_level', { min: 1 })),
                req(rf.select('approver_type', ['role', 'user'])),
                req(rf.text('approver_value')),
                rf.decimal('threshold_min'),
                rf.decimal('threshold_max'),
              ],
              { required: true },
            ),
          ),
        ],
      }),
      rowActions: [act('DELETE', 'RES.A.deactivate', '/procurement/approval-matrices/{id}', { confirm: true, danger: true })],
    },
    {
      id: 'spend',
      titleKey: 'RES.P.spend_analysis',
      module: 'procurement',
      list: { path: '/procurement/analytics/spend', report: true, filters: PERIOD_FILTERS, columns: [] },
    },
    {
      id: 'open-orders',
      titleKey: 'RES.P.open_orders',
      module: 'procurement',
      list: { path: '/procurement/analytics/open-orders', report: true, columns: [] },
    },
    {
      id: 'price-variance',
      titleKey: 'RES.P.price_variance',
      module: 'procurement',
      list: { path: '/procurement/analytics/price-variance', report: true, filters: PERIOD_FILTERS, columns: [] },
    },
    {
      id: 'invoice-approval',
      titleKey: 'RES.P.invoice_approval',
      module: 'procurement',
      list: { path: '/procurement/supplier-invoices/{invoice_id}/approval', report: true, manual: true, scope: req(rf.uuid('invoice_id')), columns: [] },
      toolbar: [
        act('POST', 'RES.A.submit_invoice_approval', '/procurement/supplier-invoices/{id}/submit-approval', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.invoice_id' })), rf.uuid('cost_center_id')],
          showResult: true,
        }),
      ],
    },
  ],
};
