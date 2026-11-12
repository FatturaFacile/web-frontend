import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const RECEIPT_FIELDS = [
  req(rf.text('supplier_delivery_note_ref')),
  req(rf.date('received_date')),
  rf.lookup('warehouse_id', 'warehouses'),
  rf.bool('inspection_required'),
  rf.select('inspection_status', ['passed', 'failed', 'conditional']),
  rf.textarea('notes'),
  req(
    rf.lines(
      'lines',
      [
        req(rf.uuid('purchase_order_line_id')),
        req(rf.decimal('quantity_received')),
        rf.decimal('quantity_accepted'),
        rf.decimal('quantity_rejected'),
        rf.uuid('warehouse_bin_id'),
        rf.text('lot_number'),
        rf.text('serial_number'),
        rf.text('rejection_reason'),
      ],
      { required: true },
    ),
  ),
];

const RETURN_FIELDS = [
  rf.uuid('purchase_receipt_id'),
  rf.lookup('supplier_id', 'suppliers'),
  req(rf.date('return_date')),
  rf.select('return_type', ['credit', 'replacement']),
  rf.text('reason'),
  rf.textarea('notes'),
  req(
    rf.lines(
      'lines',
      [
        rf.uuid('purchase_order_line_id'),
        rf.uuid('purchase_receipt_line_id'),
        req(rf.decimal('quantity_returned')),
        rf.decimal('unit_price'),
        rf.text('reason'),
      ],
      { required: true },
    ),
  ),
];

const LANDED_COST_FIELDS = [
  req(rf.select('cost_type', ['freight', 'duty', 'insurance', 'handling', 'other'])),
  req(rf.select('allocation_method', ['value', 'weight', 'quantity'])),
  req(rf.decimal('amount')),
  rf.text('currency', { maxLength: 3 }),
  req(rf.date('cost_date')),
  rf.text('description'),
  rf.uuid('passive_invoice_id'),
  rf.lookup('supplier_id', 'suppliers'),
  req(rf.tags('purchase_receipt_ids')),
];

const OPEN_ORDER = whenIn('status', 'draft', 'pending_approval', 'approved', 'sent', 'partially_received');

/** Purchase orders, goods receipts, returns, landed costs and invoice matching. */
export const PROCUREMENT_ORDERS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PROCUREMENT_ORDERS',
  tabs: [
    {
      id: 'purchase-orders',
      titleKey: 'RES.P.purchase_orders',
      module: 'procurement',
      detailPath: '/procurement/purchase-orders/{id}',
      list: {
        path: '/procurement/purchase-orders',
        filters: [rf.lookup('supplier_id', 'suppliers'), rf.select('status', ['draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled'])],
        columns: [...cols('po_number', 'supplier_id'), tagCol('status'), col('order_date', 'date'), col('expected_delivery_date', 'date'), ...cols('total_amount', 'currency')],
      },
      rowActions: [
        act('POST', 'RES.A.submit_approval', '/procurement/purchase-orders/{id}/submit-approval', { visible: whenIn('status', 'draft') }),
        act('POST', 'RES.A.approve', '/procurement/purchase-orders/{id}/approve', { confirm: true, visible: whenIn('status', 'pending_approval') }),
        act('POST', 'RES.A.reject', '/procurement/purchase-orders/{id}/reject', {
          fields: [rf.textarea('reason', { maxLength: 1000 }), rf.textarea('notes', { maxLength: 2000 }), rf.uuid('delegate_to_user_id')],
          danger: true,
          visible: whenIn('status', 'pending_approval'),
        }),
        act('POST', 'RES.A.send_order', '/procurement/purchase-orders/{id}/send', { confirm: true, visible: whenIn('status', 'approved') }),
        act('POST', 'RES.A.goods_receipt', '/procurement/purchase-orders/{orderId}/goods-receipt', {
          fields: RECEIPT_FIELDS,
          showResult: true,
          visible: whenIn('status', 'sent', 'partially_received'),
        }),
        act('POST', 'RES.A.new_return', '/procurement/purchase-orders/{orderId}/returns', { fields: RETURN_FIELDS, showResult: true }),
        act('POST', 'RES.ACTION.CANCEL', '/procurement/purchase-orders/{id}/cancel', { confirm: true, danger: true, visible: OPEN_ORDER }),
        act('POST', 'RES.A.close', '/procurement/purchase-orders/{id}/close', { confirm: true, visible: whenIn('status', 'received', 'partially_received') }),
        act('POST', 'RES.A.reopen', '/procurement/purchase-orders/{id}/reopen', { confirm: true, visible: whenIn('status', 'closed') }),
      ],
    },
    {
      id: 'requisitions',
      titleKey: 'RES.P.requisitions',
      module: 'procurement',
      detailPath: '/procurement/requisitions/{id}',
      list: {
        path: '/procurement/requisitions',
        filters: [rf.select('status', ['draft', 'pending_approval', 'approved', 'sourcing', 'ordered', 'rejected', 'cancelled']), rf.text('urgency')],
        columns: [...cols('requisition_number', 'description'), tagCol('status'), tagCol('urgency'), col('required_by_date', 'date')],
      },
      rowActions: [act('POST', 'RES.ACTION.CANCEL', '/procurement/requisitions/{id}/cancel', { confirm: true, danger: true })],
    },
    {
      id: 'goods-receipts',
      titleKey: 'RES.P.goods_receipts',
      module: 'procurement',
      detailPath: '/procurement/goods-receipts/{id}',
      list: {
        path: '/procurement/goods-receipts',
        filters: [rf.uuid('purchase_order_id')],
        columns: [...cols('receipt_number', 'purchase_order_id', 'supplier_delivery_note_ref'), col('received_date', 'date'), tagCol('status'), tagCol('inspection_status')],
      },
      rowActions: [
        act('POST', 'RES.A.release_inspection', '/procurement/goods-receipts/{id}/inspection', {
          fields: [req(rf.lines('results', [req(rf.uuid('purchase_receipt_line_id')), req(rf.decimal('quantity_released')), rf.text('notes')], { required: true }))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'returns',
      titleKey: 'RES.P.returns',
      module: 'procurement',
      detailPath: '/procurement/returns/{id}',
      list: { path: '/procurement/returns', columns: [...cols('return_number', 'purchase_order_id', 'supplier_id'), col('return_date', 'date'), tagCol('status'), col('total_amount')] },
      rowActions: [
        act('POST', 'RES.A.link_credit_note', '/procurement/returns/{id}/credit-note', {
          fields: [rf.uuid('passive_invoice_id'), rf.text('credit_note_reference', { maxLength: 100 }), rf.textarea('reason', { maxLength: 2000 })],
          showResult: true,
        }),
      ],
    },
    {
      id: 'landed-costs',
      titleKey: 'RES.P.landed_costs',
      module: 'procurement',
      detailPath: '/procurement/landed-costs/{id}',
      list: {
        path: '/procurement/landed-costs',
        columns: [...cols('landed_cost_number'), tagCol('cost_type'), tagCol('allocation_method'), tagCol('status'), ...cols('amount', 'currency'), col('cost_date', 'date')],
      },
      create: act('POST', 'RES.A.new_landed_cost', '/procurement/landed-costs', { fields: LANDED_COST_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.post', '/procurement/landed-costs/{id}/post', { confirm: true, visible: whenIn('status', 'draft') }),
        act('POST', 'RES.ACTION.CANCEL', '/procurement/landed-costs/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'draft') }),
      ],
    },
    {
      id: 'three-way-match',
      titleKey: 'RES.P.three_way_match',
      module: 'procurement',
      list: {
        path: '/procurement/three-way-match',
        filters: [rf.text('match_status')],
        columns: [...cols('purchase_order_id', 'passive_invoice_id'), tagCol('match_status'), ...cols('variance_amount')],
      },
      rowActions: [
        act('POST', 'RES.A.approve_variance', '/procurement/three-way-match/{id}/approve-variance', {
          fields: [req(rf.textarea('reason', { maxLength: 2000 }))],
          showResult: true,
        }),
      ],
      toolbar: [
        act('POST', 'RES.A.run_match', '/procurement/three-way-match/execute', {
          fields: [
            req(rf.uuid('purchase_order_id')),
            req(rf.uuid('purchase_receipt_id')),
            req(rf.uuid('passive_invoice_id')),
            req(rf.decimal('invoice_total_amount')),
          ],
          showResult: true,
        }),
        act('POST', 'RES.A.price_check', '/procurement/price-checks', {
          fields: [req(rf.uuid('purchase_order_id')), rf.uuid('passive_invoice_id'), rf.datetime('date'), rf.decimal('tolerance_percent')],
          showResult: true,
        }),
      ],
    },
  ],
};
