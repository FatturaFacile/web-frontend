import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const LOT_FIELDS = [
  req(rf.lookup('stock_item_id', 'stockItems')),
  req(rf.text('lot_number')),
  rf.select('lot_level', ['raw_material', 'packaged']),
  rf.text('supplier_lot_number'),
  rf.lookup('supplier_id', 'suppliers'),
  rf.datetime('manufacturing_date'),
  rf.datetime('expiration_date'),
  rf.datetime('received_at'),
  rf.text('certification_scheme'),
  rf.text('certification_reference'),
  rf.datetime('certification_date'),
];

const GENERAL_FILTERS = [rf.lookup('warehouse_id', 'warehouses')];

/** Stock lots: traceability, quarantine and recalls, availability by picking strategy. */
export const LOTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.LOTS',
  tabs: [
    {
      id: 'lots',
      titleKey: 'RES.P.lots',
      module: 'inventory',
      detailPath: '/inventory/lots/{id}',
      list: {
        path: '/inventory/lots',
        filters: [rf.lookup('stock_item_id', 'stockItems'), rf.select('lot_level', ['raw_material', 'packaged'])],
        columns: [...cols('lot_number', 'stock_item_id'), tagCol('lot_level'), col('expiration_date', 'date'), col('is_quarantined', 'bool')],
      },
      create: act('POST', 'RES.A.new_lot', '/inventory/lots', { fields: LOT_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/inventory/lots/{id}', { prefill: true, fields: LOT_FIELDS }),
        act('GET', 'RES.A.traceability', '/inventory/lots/{id}/traceability', { showResult: true }),
        act('POST', 'RES.A.quarantine', '/inventory/lots/{id}/quarantine', {
          confirm: true,
          visible: (row) => row['is_quarantined'] !== true,
        }),
        act('POST', 'RES.A.release_lot', '/inventory/lots/{id}/release', {
          confirm: true,
          visible: (row) => row['is_quarantined'] === true,
        }),
        act('GET', 'RES.A.recall_report', '/inventory/lots/{id}/recall', { showResult: true }),
        act('POST', 'RES.A.recall', '/inventory/lots/{id}/recall', {
          fields: [rf.bool('quarantine', { defaultValue: true })],
          showResult: true,
          danger: true,
        }),
        act('POST', 'RES.A.add_component', '/inventory/lots/{id}/components', {
          fields: [
            req(rf.uuid('component_lot_id')),
            rf.decimal('quantity_consumed'),
            rf.uuid('production_order_id'),
            rf.textarea('notes'),
          ],
        }),
      ],
    },
    {
      id: 'lot-stock',
      titleKey: 'RES.P.lot_stock',
      module: 'inventory',
      list: {
        path: '/inventory/lots/stock',
        report: true,
        filters: [rf.lookup('stock_item_id', 'stockItems'), ...GENERAL_FILTERS, rf.text('certification_reference')],
        columns: [],
      },
    },
    {
      id: 'availability',
      titleKey: 'RES.P.availability',
      module: 'inventory',
      list: {
        path: '/inventory/availability',
        report: true,
        manual: true,
        filters: [req(rf.lookup('stock_item_id', 'stockItems')), req(rf.lookup('warehouse_id', 'warehouses'))],
        columns: [],
      },
    },
  ],
};

/** Valuation at date, KPIs, quants as-of and delivery notes. */
export const STOCK_REPORTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.STOCK_REPORTS',
  tabs: [
    {
      id: 'valuation',
      titleKey: 'RES.P.valuation_at_date',
      module: 'inventory',
      list: {
        path: '/inventory/valuation/at-date',
        report: true,
        filters: [...GENERAL_FILTERS, rf.text('valuation_method')],
        columns: [],
      },
    },
    {
      id: 'kpis',
      titleKey: 'RES.P.stock_kpis',
      module: 'inventory',
      list: { path: '/inventory/kpis', report: true, filters: GENERAL_FILTERS, columns: [] },
    },
    {
      id: 'quants-as-of',
      titleKey: 'RES.P.quants_as_of',
      module: 'inventory',
      list: {
        path: '/inventory/quants/as-of',
        report: true,
        manual: true,
        filters: [req(rf.lookup('warehouse_id', 'warehouses')), req(rf.datetime('at')), rf.lookup('stock_item_id', 'stockItems')],
        columns: [],
      },
    },
    {
      id: 'quant',
      titleKey: 'RES.P.quant_detail',
      module: 'inventory',
      list: { path: '/inventory/quants/{quant_id}', report: true, manual: true, scope: req(rf.uuid('quant_id')), columns: [] },
    },
    {
      id: 'delivery-notes',
      titleKey: 'RES.P.delivery_notes',
      module: 'inventory',
      list: { path: '/inventory/delivery-notes', columns: [...cols('delivery_note_number', 'status'), col('date', 'date')] },
    },
  ],
};
