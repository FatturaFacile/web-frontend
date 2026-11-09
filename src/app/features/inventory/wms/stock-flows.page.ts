import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const TRANSFER_LINES = rf.lines(
  'lines',
  [req(rf.lookup('stock_item_id', 'stockItems')), rf.uuid('lot_id'), req(rf.decimal('quantity'))],
  { required: true },
);

const TRANSFER_FIELDS = [
  req(rf.lookup('source_warehouse_id', 'warehouses')),
  req(rf.lookup('destination_warehouse_id', 'warehouses')),
  rf.date('requested_date'),
  rf.textarea('notes'),
  req(TRANSFER_LINES),
];

const PLAN_FIELDS = [
  req(rf.lookup('warehouse_id', 'warehouses')),
  req(rf.text('name')),
  rf.select('abc_class', ['A', 'B', 'C']),
  req(rf.integer('interval_days', { min: 1 })),
  rf.bool('freezes_stock'),
  rf.bool('is_active', { defaultValue: true }),
  rf.datetime('next_run_on'),
];

const COUNT_FIELDS = [
  req(rf.lookup('warehouse_id', 'warehouses')),
  req(rf.select('count_type', ['full_physical', 'cycle_count_abc', 'spot_check', 'zone_sweep'])),
  req(rf.datetime('scheduled_date')),
  rf.lookup('warehouse_zone_id', 'zones', { dependsOn: 'warehouse_id' }),
  rf.bool('freezes_stock'),
  rf.textarea('notes'),
];

const RULE_FIELDS = [
  req(rf.lookup('warehouse_id', 'warehouses')),
  req(rf.lookup('stock_item_id', 'stockItems')),
  req(rf.decimal('min_stock_level')),
  req(rf.decimal('reorder_point')),
  req(rf.decimal('max_stock_level')),
  req(rf.decimal('economic_order_quantity')),
  rf.integer('lead_time_days', { min: 0 }),
  rf.lookup('preferred_supplier_id', 'suppliers'),
  rf.bool('auto_trigger_requisition'),
];

/** Transfer orders between warehouses. */
export const TRANSFERS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.TRANSFERS',
  tabs: [
    {
      id: 'transfer-orders',
      titleKey: 'RES.P.transfer_orders',
      module: 'inventory',
      detailPath: '/inventory/transfer-orders/{id}',
      list: {
        path: '/inventory/transfer-orders',
        columns: [
          ...cols('transfer_number', 'source_warehouse_id', 'destination_warehouse_id'),
          tagCol('status'),
          col('requested_date', 'date'),
          col('shipped_at', 'datetime'),
          col('received_at', 'datetime'),
        ],
      },
      create: act('POST', 'RES.A.new_transfer', '/inventory/transfer-orders', { fields: TRANSFER_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.ship', '/inventory/transfer-orders/{id}/ship', {
          confirm: true,
          visible: whenIn('status', 'draft', 'open', 'requested', 'pending'),
        }),
        act('POST', 'RES.A.receive', '/inventory/transfer-orders/{id}/receive', {
          prefill: true,
          fields: TRANSFER_FIELDS,
          visible: whenIn('status', 'in_transit', 'shipped', 'partially_received'),
        }),
        act('POST', 'RES.ACTION.CANCEL', '/inventory/transfer-orders/{id}/cancel', {
          confirm: true,
          danger: true,
          visible: (row) => !['received', 'cancelled'].includes(String(row['status'])),
        }),
      ],
    },
  ],
};

/** Cycle counting: ABC classification, count plans and count sessions. */
export const COUNTING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.COUNTING',
  tabs: [
    {
      id: 'count-plans',
      titleKey: 'RES.P.count_plans',
      module: 'inventory',
      list: {
        path: '/inventory/cycle-count-plans',
        columns: [
          ...cols('name', 'warehouse_id'),
          tagCol('abc_class'),
          col('interval_days'),
          col('freezes_stock', 'bool'),
          col('is_active', 'bool'),
          col('last_run_at', 'datetime'),
          col('next_run_on', 'date'),
        ],
      },
      create: act('POST', 'RES.A.new_plan', '/inventory/cycle-count-plans', { fields: PLAN_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.run_plan', '/inventory/cycle-count-plans/{id}/run', { confirm: true, showResult: true }),
        act('PUT', 'RES.ACTION.EDIT', '/inventory/cycle-count-plans/{id}', { prefill: true, fields: PLAN_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/inventory/cycle-count-plans/{id}', { confirm: true, danger: true }),
      ],
      toolbar: [
        act('POST', 'RES.A.run_due_plans', '/inventory/cycle-count-plans/run-due', { confirm: true, showResult: true }),
        act('POST', 'RES.A.run_abc', '/inventory/abc-classification/run', { confirm: true, showResult: true }),
      ],
    },
    {
      id: 'counts',
      titleKey: 'RES.P.counts',
      module: 'inventory',
      detailPath: '/inventory/counts/{id}',
      list: {
        path: '/inventory/counts',
        filters: [rf.lookup('warehouse_id', 'warehouses'), rf.text('status')],
        columns: [...cols('count_number', 'warehouse_id'), tagCol('count_type'), tagCol('status'), col('freezes_stock', 'bool'), col('scheduled_date', 'datetime')],
      },
      create: act('POST', 'RES.A.new_count', '/inventory/counts', { fields: COUNT_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.recount', '/inventory/counts/{id}/recount', { confirm: true }),
        act('POST', 'RES.A.reconcile', '/inventory/counts/{id}/reconcile', {
          confirm: true,
          visible: (row) => !['reconciled', 'cancelled'].includes(String(row['status'])),
        }),
        act('POST', 'RES.ACTION.CANCEL', '/inventory/counts/{id}/cancel', {
          confirm: true,
          danger: true,
          visible: (row) => !['reconciled', 'cancelled'].includes(String(row['status'])),
        }),
      ],
    },
  ],
};

/** Reorder rules, replenishment suggestions and hand-off to procurement. */
export const REPLENISHMENT_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.REPLENISHMENT',
  tabs: [
    {
      id: 'reorder-rules',
      titleKey: 'RES.P.reorder_rules',
      module: 'inventory',
      list: {
        path: '/inventory/reorder-rules',
        columns: [
          ...cols('stock_item_id', 'warehouse_id', 'min_stock_level', 'reorder_point', 'max_stock_level', 'economic_order_quantity', 'lead_time_days'),
          col('auto_trigger_requisition', 'bool'),
        ],
      },
      create: act('POST', 'RES.A.new_rule', '/inventory/reorder-rules', { fields: RULE_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/inventory/reorder-rules/{id}', { prefill: true, fields: RULE_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/inventory/reorder-rules/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'replenishment',
      titleKey: 'RES.P.replenishment_suggestions',
      module: 'inventory',
      list: {
        path: '/inventory/replenishment/suggestions',
        columns: [...cols('sku', 'warehouse_id', 'available', 'min_stock_level', 'reorder_point', 'suggested_quantity'), col('needs_replenishment', 'bool')],
      },
      toolbar: [act('POST', 'RES.A.hand_off_procurement', '/inventory/replenishment/hand-off', { confirm: true, showResult: true })],
    },
  ],
};
