import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const CATALOG_FIELDS = [
  req(rf.lookup('supplier_id', 'suppliers')),
  req(rf.text('supplier_part_number')),
  rf.text('internal_sku'),
  req(rf.text('name')),
  rf.textarea('description'),
  rf.text('uom'),
  rf.integer('lead_time_days', { min: 0 }),
  rf.decimal('minimum_order_quantity'),
  rf.bool('is_active', { defaultValue: true }),
];

const CONTRACT_FIELDS = [
  req(rf.lookup('supplier_id', 'suppliers')),
  req(rf.text('contract_number')),
  req(rf.text('title')),
  req(rf.select('contract_type', ['framework', 'service_level', 'standard', 'blanket'])),
  rf.select('status', ['draft', 'active', 'expired', 'terminated']),
  req(rf.datetime('starts_at')),
  req(rf.datetime('ends_at', { notBefore: 'starts_at' })),
  rf.decimal('total_committed_amount'),
  rf.text('payment_terms_code'),
  rf.text('incoterms'),
];

const RFQ_FIELDS = [
  req(rf.text('title')),
  req(rf.date('response_deadline')),
  rf.text('currency', { maxLength: 3 }),
  rf.uuid('purchase_requisition_id'),
  rf.uuid('cost_center_id'),
  rf.textarea('notes'),
  req(rf.tags('supplier_ids')),
  rf.lines('lines', [
    req(rf.text('description')),
    req(rf.decimal('quantity')),
    rf.text('uom'),
    rf.text('internal_sku'),
    rf.date('required_by_date'),
  ]),
];

const QUOTE_FIELDS = [
  req(rf.lookup('supplier_id', 'suppliers')),
  rf.text('quote_reference'),
  req(rf.date('quote_date')),
  rf.date('valid_until', { notBefore: 'quote_date' }),
  rf.integer('lead_time_days', { min: 0 }),
  rf.textarea('notes'),
  req(
    rf.lines(
      'lines',
      [req(rf.uuid('rfq_line_id')), req(rf.decimal('unit_price')), rf.decimal('quantity'), rf.decimal('tax_rate'), rf.integer('lead_time_days')],
      { required: true },
    ),
  ),
];

const CONTRACT_LINE_FIELDS = [
  rf.uuid('supplier_catalog_id'),
  req(rf.text('description')),
  rf.text('uom'),
  req(rf.decimal('unit_price')),
  rf.decimal('tax_rate'),
  rf.decimal('committed_quantity'),
  req(rf.date('price_valid_from')),
  rf.date('price_valid_to', { notBefore: 'price_valid_from' }),
];

const CALL_OFF_FIELDS = [
  rf.date('order_date'),
  req(rf.date('expected_delivery_date', { notBefore: 'order_date' })),
  rf.uuid('cost_center_id'),
  rf.uuid('project_id'),
  rf.textarea('notes'),
  req(
    rf.lines(
      'lines',
      [req(rf.uuid('supplier_contract_line_id')), req(rf.decimal('quantity_ordered')), rf.date('expected_delivery_date')],
      { required: true },
    ),
  ),
];

const OPEN_RFQ = whenIn('status', 'draft', 'issued', 'open', 'quoted');

/** Sourcing: RFQ, supplier catalogs and prices, framework agreements, purchase suggestions. */
export const SOURCING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SOURCING',
  tabs: [
    {
      id: 'rfqs',
      titleKey: 'RES.P.rfqs',
      module: 'procurement',
      detailPath: '/procurement/rfqs/{id}',
      list: {
        path: '/procurement/rfqs',
        columns: [...cols('rfq_number', 'title'), tagCol('status'), col('response_deadline', 'date'), ...cols('currency', 'awarded_supplier_id')],
      },
      create: act('POST', 'RES.A.new_rfq', '/procurement/rfqs', { fields: RFQ_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.issue_rfq', '/procurement/rfqs/{id}/issue', { confirm: true, visible: whenIn('status', 'draft') }),
        act('POST', 'RES.A.record_quote', '/procurement/rfqs/{id}/quotes', { fields: QUOTE_FIELDS, visible: OPEN_RFQ }),
        act('GET', 'RES.A.comparison', '/procurement/rfqs/{id}/comparison', { showResult: true }),
        act('POST', 'RES.A.award', '/procurement/rfqs/{id}/award', {
          fields: [req(rf.uuid('supplier_quote_id')), rf.date('expected_delivery_date')],
          showResult: true,
          visible: OPEN_RFQ,
        }),
        act('POST', 'RES.ACTION.CANCEL', '/procurement/rfqs/{id}/cancel', { confirm: true, danger: true, visible: OPEN_RFQ }),
      ],
    },
    {
      id: 'catalogs',
      titleKey: 'RES.P.catalogs',
      module: 'procurement',
      detailPath: '/procurement/catalogs/{id}',
      list: {
        path: '/procurement/catalogs',
        columns: [...cols('supplier_part_number', 'internal_sku', 'name', 'uom', 'lead_time_days', 'minimum_order_quantity'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_catalog_entry', '/procurement/catalogs', { fields: CATALOG_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/procurement/catalogs/{id}', { prefill: true, fields: CATALOG_FIELDS }),
        act('POST', 'RES.A.add_price', '/procurement/catalogs/{id}/prices', {
          fields: [rf.text('currency', { maxLength: 3 }), rf.decimal('min_quantity'), req(rf.decimal('unit_price')), req(rf.date('valid_from')), rf.date('valid_to', { notBefore: 'valid_from' })],
        }),
        act('GET', 'RES.A.applicable_price', '/procurement/catalogs/{id}/price', {
          fields: [rf.decimal('quantity'), rf.date('date')],
          showResult: true,
        }),
      ],
    },
    {
      id: 'offers',
      titleKey: 'RES.P.offers',
      module: 'procurement',
      list: { path: '/procurement/offers', report: true, manual: true, filters: [req(rf.text('sku')), rf.decimal('quantity')], columns: [] },
    },
    {
      id: 'contracts',
      titleKey: 'RES.P.contracts',
      module: 'procurement',
      detailPath: '/procurement/contracts/{id}',
      list: {
        path: '/procurement/contracts',
        filters: [rf.lookup('supplier_id', 'suppliers'), rf.select('status', ['draft', 'active', 'expired', 'terminated'])],
        columns: [...cols('contract_number', 'title'), tagCol('contract_type'), tagCol('status'), col('starts_at', 'date'), col('ends_at', 'date'), ...cols('total_committed_amount', 'consumed_amount')],
      },
      create: act('POST', 'RES.A.new_contract', '/procurement/contracts', { fields: CONTRACT_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/procurement/contracts/{id}', { prefill: true, fields: CONTRACT_FIELDS }),
        act('GET', 'RES.A.contract_lines', '/procurement/contracts/{id}/lines', { showResult: true }),
        act('POST', 'RES.A.add_contract_line', '/procurement/contracts/{id}/lines', { fields: CONTRACT_LINE_FIELDS }),
        act('POST', 'RES.A.call_off', '/procurement/contracts/{id}/call-offs', { fields: CALL_OFF_FIELDS, showResult: true }),
        act('DELETE', 'RES.ACTION.DELETE', '/procurement/contracts/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'purchase-suggestions',
      titleKey: 'RES.P.purchase_suggestions',
      module: 'procurement',
      list: {
        path: '/procurement/purchase-suggestions',
        columns: [...cols('description', 'stock_item_id', 'supplier_id', 'quantity', 'uom', 'unit_price'), col('required_by_date', 'date'), tagCol('status'), tagCol('source')],
      },
      rowActions: [act('POST', 'RES.A.dismiss', '/procurement/purchase-suggestions/{id}/dismiss', { confirm: true, visible: whenIn('status', 'open', 'pending', 'new') })],
      toolbar: [
        act('POST', 'RES.A.generate_suggestions', '/procurement/purchase-suggestions/generate', { confirm: true, showResult: true }),
        act('POST', 'RES.A.convert_suggestions', '/procurement/purchase-suggestions/convert', {
          fields: [req(rf.tags('suggestion_ids'))],
          showResult: true,
        }),
      ],
    },
  ],
};
