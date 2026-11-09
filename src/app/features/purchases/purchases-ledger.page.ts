import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const ORDER_LINES = req(
  rf.lines(
    'items',
    [rf.uuid('product_id'), req(rf.text('description')), req(rf.decimal('quantity')), req(rf.decimal('unit_price')), req(rf.decimal('tax_rate'))],
    { required: true },
  ),
);

const ORDER_FIELDS = [
  req(rf.lookup('supplier_id', 'suppliers')),
  req(rf.datetime('date')),
  rf.datetime('delivery_due_date'),
  req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
  rf.textarea('notes'),
  ORDER_LINES,
];

const SELF_INVOICE_TYPES = [
  'TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD16', 'TD17', 'TD18', 'TD19', 'TD20',
  'TD21', 'TD22', 'TD23', 'TD24', 'TD25', 'TD26', 'TD27', 'TD28', 'TD29',
] as const;

const OPEN_ORDER = whenIn('status', 'draft', 'pending', 'open');

/** Purchase orders and goods receipts of the purchases module. */
export const PURCHASE_ORDERS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PURCHASE_ORDERS',
  tabs: [
    {
      id: 'purchase-orders',
      titleKey: 'RES.P.purchase_orders',
      module: 'procurement',
      detailPath: '/purchases/orders/{id}',
      list: {
        path: '/purchases/orders',
        columns: [...cols('order_number', 'supplier_id'), tagCol('status'), col('date', 'date'), ...cols('total_net', 'total_gross', 'currency')],
      },
      create: act('POST', 'RES.A.new_order', '/purchases/orders', { fields: ORDER_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/purchases/orders/{id}', { prefill: true, fields: ORDER_FIELDS, visible: OPEN_ORDER }),
        act('POST', 'RES.A.confirm', '/purchases/orders/{id}/confirm', { confirm: true, visible: OPEN_ORDER }),
        act('POST', 'RES.A.receive_goods', '/purchases/orders/{id}/receive', {
          fields: [rf.datetime('date'), rf.textarea('notes')],
          showResult: true,
        }),
      ],
    },
    {
      id: 'purchase-requests',
      titleKey: 'RES.P.purchase_requests',
      module: 'procurement',
      list: { path: '/purchases/requests', columns: [...cols('request_number', 'description'), tagCol('status'), col('created_at', 'datetime')] },
    },
    {
      id: 'goods-receipts',
      titleKey: 'RES.P.goods_receipts',
      module: 'procurement',
      detailPath: '/purchases/goods-receipts/{id}',
      list: { path: '/purchases/goods-receipts', columns: [...cols('receipt_number', 'purchase_order_id'), col('date', 'date'), tagCol('status')] },
    },
  ],
};

/** Cost-account rules, supplier invoice lines, payment export and self-invoices. */
export const PURCHASE_INVOICES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PURCHASE_INVOICES',
  tabs: [
    {
      id: 'cost-rules',
      titleKey: 'RES.P.cost_rules',
      module: 'procurement',
      list: { path: '/purchases/cost-rules', columns: [...cols('supplier_id', 'keyword', 'cost_account_id')] },
      create: act('POST', 'RES.A.new_cost_rule', '/purchases/cost-rules', {
        fields: [req(rf.lookup('supplier_id', 'suppliers')), rf.text('keyword'), req(rf.uuid('cost_account_id'))],
      }),
      rowActions: [act('DELETE', 'RES.ACTION.DELETE', '/purchases/cost-rules/{id}', { confirm: true, danger: true })],
    },
    {
      id: 'invoice-tools',
      titleKey: 'RES.P.invoice_tools',
      module: 'procurement',
      list: { path: '/purchases/supplier-invoices/{invoice_id}/lines', manual: true, scope: req(rf.uuid('invoice_id')), columns: [...cols('description', 'quantity', 'unit_price', 'cost_account_id')] },
      toolbar: [
        act('PUT', 'RES.A.set_cost_account', '/purchases/supplier-invoices/{invoice_id}/cost-account', {
          fields: [req(rf.uuid('cost_account_id')), rf.tags('line_ids')],
        }),
        act('POST', 'RES.A.self_invoice', '/purchases/passive-invoices/{id}/self-invoice', {
          showResult: true,
          fields: [
            req(rf.uuid('id', { labelKey: 'RES.F.passive_invoice_id' })),
            req(rf.select('document_type', SELF_INVOICE_TYPES)),
            req(rf.datetime('date')),
            req(rf.decimal('tax_rate')),
            rf.text('vat_nature'),
            rf.text('description'),
            rf.textarea('notes'),
          ],
        }),
        act('POST', 'RES.A.export_pain001', '/purchases/export-pain001', {
          download: true,
          fields: [
            req(rf.tags('invoice_ids')),
            req(rf.select('format', ['sepa_pain_001_it', 'iso_pain_001_ch'])),
            rf.datetime('execution_date'),
            rf.uuid('bank_account_id'),
          ],
        }),
      ],
    },
  ],
};
