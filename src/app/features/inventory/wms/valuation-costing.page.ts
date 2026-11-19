import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const VALUATION_METHODS = ['fifo', 'weighted_average', 'standard_cost'] as const;
const LANDED_COST_TYPES = ['freight', 'customs_duty', 'insurance', 'brokerage', 'other'] as const;
const LANDED_ALLOCATION_KEYS = ['value', 'weight', 'volume', 'quantity'] as const;
const CHARGE_BASES = ['per_unit', 'per_kg', 'per_litre', 'percent_of_net'] as const;

const today = (): string => new Date().toISOString().slice(0, 10);

const LANDED_COST_FIELDS = [
  req(rf.date('document_date', { defaultValue: today() })),
  req(rf.select('cost_type', LANDED_COST_TYPES)),
  req(rf.select('allocation_key', LANDED_ALLOCATION_KEYS)),
  req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
  rf.decimal('exchange_rate', { positive: true }),
  req(rf.decimal('total_amount', { positive: true })),
  rf.uuid('supplier_invoice_id'),
  rf.textarea('notes', { maxLength: 2000 }),
  req(rf.tags('receipt_ids')),
];

const BOOK_FIELDS = [
  req(rf.integer('year', { min: 1900, max: 2999, defaultValue: new Date().getFullYear() - 1 })),
  rf.date('as_of'),
  rf.lookup('warehouse_id', 'warehouses'),
  rf.bool('require_closed'),
];

/** Valuation method configuration, cost layers, landed costs, inventory book and product charges. */
export const VALUATION_COSTING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.VALUATION_COSTING',
  tabs: [
    {
      id: 'valuation-config',
      titleKey: 'RES.P.valuation_config',
      module: 'inventory',
      list: {
        path: '/inventory/valuation/config',
        filters: [rf.lookup('item_id', 'stockItems'), rf.uuid('category_id')],
        columns: [...cols('sku'), tagCol('effective_method'), ...cols('category_method', 'item_method', 'source')],
      },
      rowActions: [
        act('PUT', 'RES.A.set_item_valuation', '/inventory/valuation/items/{item_id}', {
          fields: [
            rf.select('valuation_method', VALUATION_METHODS),
            rf.decimal('standard_cost', { min: 0 }),
            rf.decimal('weight_kg', { min: 0 }),
            rf.decimal('volume_m3', { min: 0 }),
            rf.bool('revalue_on_change'),
          ],
          showResult: true,
        }),
        act('PUT', 'RES.A.set_category_valuation', '/inventory/valuation/categories/{category_id}', {
          fields: [
            req(rf.select('valuation_method', VALUATION_METHODS)),
            rf.uuid('inventory_account_id'),
            rf.uuid('cogs_account_id'),
            rf.uuid('ppv_account_id'),
            rf.uuid('landed_cost_clearing_account_id'),
          ],
          visible: (row) => Boolean(row['category_id']),
          showResult: true,
        }),
      ],
    },
    {
      id: 'cost-layers',
      titleKey: 'RES.P.cost_layers',
      module: 'inventory',
      list: {
        path: '/inventory/valuation/cost-layers',
        filters: [rf.lookup('item_id', 'stockItems'), rf.lookup('warehouse_id', 'warehouses'), rf.uuid('lot_id'), rf.bool('open_only')],
        columns: [...cols('stock_item_id', 'warehouse_id', 'quantity', 'remaining_quantity', 'unit_cost'), col('received_at', 'datetime')],
      },
    },
    {
      id: 'landed-costs',
      titleKey: 'RES.P.landed_costs',
      module: 'inventory',
      detailPath: '/inventory/landed-costs/{id}',
      list: {
        path: '/inventory/landed-costs',
        filters: [rf.text('status'), rf.uuid('receipt_id'), rf.date('from'), rf.date('to')],
        columns: [
          ...cols('number', 'cost_type', 'allocation_key'),
          tagCol('status'),
          ...cols('currency', 'total_amount'),
          col('document_date', 'date'),
        ],
      },
      create: act('POST', 'RES.A.new_landed_cost', '/inventory/landed-costs', { fields: LANDED_COST_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.apply', '/inventory/landed-costs/{id}/apply', { confirm: true, visible: whenIn('status', 'draft') }),
        act('POST', 'RES.A.reverse', '/inventory/landed-costs/{id}/reverse', {
          fields: [req(rf.textarea('reason', { maxLength: 500 }))],
          danger: true,
          visible: whenIn('status', 'applied'),
        }),
      ],
      toolbar: [act('POST', 'RES.A.preview_landed_cost', '/inventory/landed-costs/preview', { fields: LANDED_COST_FIELDS, showResult: true })],
    },
    {
      id: 'book-exports',
      titleKey: 'RES.P.inventory_book_exports',
      module: 'inventory',
      list: {
        path: '/inventory/book/exports',
        filters: [rf.integer('year')],
        columns: [
          ...cols('year'),
          col('as_of', 'date'),
          ...cols('warehouse_id', 'rows_count'),
          tagCol('status'),
          col('generated_at', 'datetime'),
        ],
      },
      create: act('POST', 'RES.A.new_book_export', '/inventory/book/exports', { fields: BOOK_FIELDS }),
      rowActions: [act('GET', 'RES.A.download', '/inventory/book/exports/{id}/download', { download: true })],
    },
    {
      id: 'product-charges',
      titleKey: 'RES.P.product_charges',
      module: 'inventory',
      list: {
        path: '/invoicing/product-charges',
        columns: cols('code', 'name', 'calculation_basis', 'revenue_account_id'),
      },
      create: act('POST', 'RES.A.new_product_charge', '/invoicing/product-charges', {
        fields: [
          req(rf.text('code', { maxLength: 50 })),
          req(rf.text('name', { maxLength: 150 })),
          req(rf.select('calculation_basis', CHARGE_BASES)),
          req(rf.uuid('revenue_account_id')),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.add_charge_rate', '/invoicing/product-charges/{id}/rates', {
          fields: [
            req(rf.decimal('rate', { min: 0 })),
            req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
            req(rf.date('valid_from')),
            rf.date('valid_to', { notBefore: 'valid_from' }),
          ],
        }),
        act('POST', 'RES.A.assign_charge_product', '/invoicing/product-charges/{id}/products', {
          fields: [req(rf.lookup('product_id', 'stockItems')), rf.decimal('quantity_per_unit', { positive: true })],
        }),
      ],
      toolbar: [
        act('POST', 'RES.A.preview_product_charges', '/invoicing/product-charges/preview', {
          fields: [
            req(rf.date('date', { defaultValue: today() })),
            req(rf.text('currency', { maxLength: 3, defaultValue: 'EUR' })),
            req(
              rf.lines(
                'lines',
                [
                  rf.uuid('product_id'),
                  req(rf.decimal('quantity')),
                  req(rf.decimal('unit_price')),
                  req(rf.decimal('tax_rate')),
                  rf.decimal('discount_percentage'),
                ],
                { required: true },
              ),
            ),
          ],
          showResult: true,
        }),
      ],
    },
  ],
};
