import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const ORDER_FIELDS = [
  req(rf.lookup('mfg_item_id', 'mfgItems')),
  req(rf.decimal('target_quantity')),
  req(rf.datetime('planned_start_date')),
  req(rf.datetime('planned_end_date')),
  rf.uuid('bom_id'),
  rf.uuid('routing_id'),
  rf.uuid('project_id'),
  rf.uuid('sales_order_id'),
  rf.lookup('warehouse_id', 'warehouses'),
  rf.lookup('receipt_warehouse_id', 'warehouses'),
  rf.textarea('notes'),
];

const ISSUE_FIELDS = [
  rf.datetime('posting_date'),
  rf.bool('allow_over_issue'),
  req(rf.lines('lines', [req(rf.uuid('line_id')), req(rf.decimal('quantity')), rf.uuid('lot_id')], { required: true })),
];

const CONFIRMATION_FIELDS = [
  req(rf.uuid('operationId', { labelKey: 'RES.F.operation_id' })),
  rf.decimal('setup_minutes'),
  rf.decimal('run_minutes'),
  rf.decimal('labor_minutes'),
  rf.decimal('downtime_minutes'),
  rf.decimal('good_quantity'),
  rf.decimal('scrap_quantity'),
  rf.text('scrap_reason'),
  rf.bool('is_final'),
  rf.datetime('posting_date'),
];

const RECEIPT_FIELDS = [
  req(rf.decimal('quantity')),
  rf.text('lot_number'),
  rf.tags('serial_numbers'),
  rf.lookup('warehouse_id', 'warehouses'),
  rf.datetime('posting_date'),
];

const SUBCONTRACT_SEND_FIELDS = [
  req(rf.uuid('production_order_operation_id')),
  req(rf.uuid('subcontractor_contact_id')),
  req(rf.lookup('subcontract_warehouse_id', 'warehouses')),
  rf.lookup('source_warehouse_id', 'warehouses'),
  req(rf.decimal('quantity')),
  rf.decimal('unit_cost'),
  rf.datetime('posting_date'),
  rf.textarea('notes'),
];

const JOB_CARD_FIELDS = [req(rf.uuid('production_order_operation_id')), rf.uuid('operator_id'), rf.uuid('machine_id')];

const ACTIVE_ORDER = whenIn('status', 'released', 'in_progress');

/** Production orders and their execution: issues, confirmations, receipts, costs and subcontracting. */
export const MFG_PRODUCTION_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.MFG_PRODUCTION',
  tabs: [
    {
      id: 'production-orders',
      titleKey: 'RES.P.production_orders',
      module: 'manufacturing',
      detailPath: '/manufacturing/production-orders/{id}',
      list: {
        path: '/manufacturing/production-orders',
        columns: [
          ...cols('order_number', 'mfg_item_id'),
          tagCol('status'),
          ...cols('target_quantity', 'completed_quantity', 'scrapped_quantity'),
          col('planned_start_date', 'date'),
          col('planned_end_date', 'date'),
        ],
      },
      create: act('POST', 'RES.A.new_production_order', '/manufacturing/production-orders', { fields: ORDER_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.release_order', '/manufacturing/production-orders/{id}/release', { confirm: true, visible: whenIn('status', 'planned') }),
        act('POST', 'RES.A.reschedule', '/manufacturing/production-orders/{id}/reschedule', {
          fields: [req(rf.datetime('planned_start_date')), req(rf.datetime('planned_end_date'))],
          visible: whenIn('status', 'planned', 'released'),
        }),
        act('POST', 'RES.A.start', '/manufacturing/production-orders/{id}/start', { confirm: true, visible: whenIn('status', 'released') }),
        act('POST', 'RES.A.issue_components', '/manufacturing/production-orders/{id}/issues', { fields: ISSUE_FIELDS, showResult: true, visible: ACTIVE_ORDER }),
        act('POST', 'RES.A.confirm_operation', '/manufacturing/production-orders/{id}/operations/{operationId}/confirmations', {
          fields: CONFIRMATION_FIELDS,
          showResult: true,
          visible: ACTIVE_ORDER,
        }),
        act('POST', 'RES.A.receive_output', '/manufacturing/production-orders/{id}/receipts', { fields: RECEIPT_FIELDS, showResult: true, visible: ACTIVE_ORDER }),
        act('POST', 'RES.A.send_subcontract', '/manufacturing/production-orders/{id}/subcontract-orders', {
          fields: SUBCONTRACT_SEND_FIELDS,
          showResult: true,
          visible: ACTIVE_ORDER,
        }),
        act('POST', 'RES.A.finish_order', '/manufacturing/production-orders/{id}/complete', { confirm: true, visible: ACTIVE_ORDER }),
        act('POST', 'RES.A.close_order', '/manufacturing/production-orders/{id}/close', { confirm: true, showResult: true, visible: whenIn('status', 'completed') }),
        act('POST', 'RES.ACTION.CANCEL', '/manufacturing/production-orders/{id}/cancel', {
          fields: [req(rf.textarea('reason'))],
          danger: true,
          visible: whenIn('status', 'planned', 'released'),
        }),
        act('GET', 'RES.A.transactions', '/manufacturing/production-orders/{id}/transactions', { showResult: true }),
        act('GET', 'RES.A.cost_report', '/manufacturing/production-orders/{id}/cost-rollup', { showResult: true }),
      ],
    },
    {
      id: 'subcontract-orders',
      titleKey: 'RES.P.subcontract_orders',
      module: 'manufacturing',
      detailPath: '/manufacturing/subcontract-orders/{id}',
      list: {
        path: '/manufacturing/subcontract-orders',
        columns: [...cols('subcontract_number', 'subcontractor_contact_id'), tagCol('status'), ...cols('quantity', 'received_quantity', 'total_cost'), col('sent_at', 'datetime')],
      },
      rowActions: [
        act('POST', 'RES.A.receive_subcontract', '/manufacturing/subcontract-orders/{id}/receive', {
          fields: [req(rf.decimal('good_quantity')), rf.decimal('scrap_quantity'), rf.datetime('posting_date')],
          showResult: true,
          visible: whenIn('status', 'sent', 'partially_received'),
        }),
        act('POST', 'RES.ACTION.CANCEL', '/manufacturing/subcontract-orders/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'sent') }),
      ],
    },
    {
      id: 'shop-floor',
      titleKey: 'RES.P.shop_floor',
      module: 'manufacturing',
      list: {
        path: '/manufacturing/shop-floor/executions',
        columns: [...cols('execution_number', 'production_order_id'), tagCol('status'), ...cols('good_units', 'scrap_units', 'downtime_minutes'), col('started_at', 'datetime'), col('completed_at', 'datetime')],
      },
      create: act('POST', 'RES.A.start_job_card', '/manufacturing/shop-floor/executions', { fields: JOB_CARD_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.finish_job_card', '/manufacturing/shop-floor/executions/{id}/complete', {
          fields: [
            req(rf.decimal('good_units')),
            rf.decimal('scrap_units'),
            rf.text('scrap_reason'),
            rf.decimal('setup_minutes'),
            rf.decimal('labor_minutes'),
            rf.bool('is_final'),
            rf.datetime('posting_date'),
          ],
          showResult: true,
          visible: whenIn('status', 'started', 'in_progress', 'running'),
        }),
        act('POST', 'RES.A.report_downtime', '/manufacturing/shop-floor/executions/{id}/downtime', {
          fields: [req(rf.decimal('downtime_minutes')), req(rf.text('reason'))],
        }),
      ],
    },
  ],
};
