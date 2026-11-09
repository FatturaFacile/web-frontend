import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const ITEM_FIELDS = [
  req(rf.uuid('category_id')),
  req(rf.text('sku')),
  req(rf.text('name')),
  req(rf.text('uom')),
  rf.textarea('description'),
  rf.text('barcode_ean13'),
  rf.text('barcode_custom'),
  req(rf.select('tracking_type', ['none', 'lot', 'serial'], { defaultValue: 'none' })),
  rf.decimal('standard_cost'),
  rf.uuid('product_id'),
  rf.select('picking_strategy', ['fifo', 'fefo', 'lifo']),
  rf.integer('shelf_life_days', { min: 0 }),
  rf.integer('min_remaining_shelf_life_days', { min: 0 }),
  rf.decimal('net_weight_kg'),
  rf.decimal('volume_m3'),
  rf.integer('units_per_carton', { min: 1 }),
  rf.integer('cartons_per_pallet', { min: 1 }),
  rf.decimal('weight_kg'),
  rf.bool('is_active', { defaultValue: true }),
];

const VARIANT_FIELDS = [
  rf.text('sku'),
  req(rf.json('attributes', { defaultValue: '[]' })),
  rf.decimal('price'),
  rf.text('barcode'),
  rf.decimal('min_stock'),
  rf.bool('discontinue_on_zero_stock'),
  rf.bool('is_active', { defaultValue: true }),
];

const REPAIR_STATUSES = ['diagnosing', 'waiting_parts', 'repairing', 'ready', 'delivered', 'cancelled'] as const;

const SERIAL_ID = req(rf.uuid('id', { labelKey: 'RES.F.serial_id' }));

/** Stock item master data, variants and product barcodes. */
export const STOCK_ITEMS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.STOCK_ITEMS',
  tabs: [
    {
      id: 'stock-items',
      titleKey: 'RES.P.stock_items',
      module: 'inventory',
      detailPath: '/inventory/items/{id}',
      list: {
        path: '/inventory/items',
        filters: [rf.uuid('category_id'), rf.select('tracking_type', ['none', 'lot', 'serial'])],
        columns: [...cols('sku', 'name', 'uom'), tagCol('tracking_type'), col('standard_cost'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_item', '/inventory/items', { fields: ITEM_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/inventory/items/{id}', { prefill: true, fields: ITEM_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/inventory/items/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'variants',
      titleKey: 'RES.P.variants',
      module: 'inventory',
      detailPath: '/inventory/products/variants/{variantId}',
      list: {
        path: '/inventory/products/{parentId}/variants',
        scope: req(rf.uuid('parentId', { labelKey: 'RES.F.parent_product_id' })),
        columns: [...cols('sku', 'barcode', 'price', 'stock'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_variant', '/inventory/products/{parentId}/variants', { fields: VARIANT_FIELDS }),
      toolbar: [
        act('POST', 'RES.A.generate_variants', '/inventory/products/{parentId}/variants/generate', {
          showResult: true,
          fields: [
            req(rf.json('attributes', { defaultValue: '[["S","M","L"],["Red","Blue"]]' })),
            rf.json('price_modifier'),
            rf.bool('auto_generate_sku'),
            rf.bool('generate_barcode'),
            rf.select('barcode_type', ['ean13', 'code128']),
            rf.bool('discontinue_on_zero_stock'),
            rf.decimal('min_stock'),
          ],
        }),
      ],
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/inventory/products/variants/{variantId}', { prefill: true, fields: VARIANT_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/inventory/products/variants/{variantId}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'labels',
      titleKey: 'RES.P.labels',
      module: 'inventory',
      list: { path: '/inventory/labels/presets', report: true, columns: [] },
      toolbar: [
        act('POST', 'RES.A.print_labels', '/inventory/labels/print', {
          download: true,
          fields: [
            rf.select('layout_mode', ['preset', 'custom']),
            rf.text('preset'),
            rf.json('layout'),
            rf.integer('start_offset', { min: 0 }),
            req(rf.lines('items', [req(rf.uuid('product_id')), req(rf.integer('quantity', { min: 1 }))], { required: true })),
            rf.json('content_options'),
          ],
        }),
        act('GET', 'RES.A.product_barcode', '/inventory/products/{id}/barcode', {
          download: true,
          fields: [
            req(rf.uuid('id', { labelKey: 'RES.F.product_id' })),
            rf.select('format', ['svg', 'png']),
            rf.select('type', ['ean13', 'ean8', 'code128', 'code39', 'qrcode']),
          ],
        }),
      ],
    },
  ],
};

/** After-sales: repair orders, warranty, weighbridge and safety data sheets. */
export const INVENTORY_SERVICES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.INVENTORY_SERVICES',
  tabs: [
    {
      id: 'repair-orders',
      titleKey: 'RES.P.repair_orders',
      module: 'inventory',
      detailPath: '/inventory/repair-orders/{id}',
      list: {
        path: '/inventory/repair-orders',
        columns: [...cols('repair_number', 'stock_item_id'), tagCol('status'), col('is_under_warranty', 'bool'), ...cols('labour_amount', 'parts_amount'), col('received_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_repair', '/inventory/repair-orders', {
        fields: [req(rf.uuid('stock_serial_number_id')), rf.uuid('contact_id'), req(rf.textarea('fault_description'))],
      }),
      rowActions: [
        act('POST', 'RES.A.change_status', '/inventory/repair-orders/{id}/status', {
          fields: [req(rf.select('status', REPAIR_STATUSES)), rf.textarea('diagnosis'), rf.textarea('resolution'), rf.decimal('labour_amount')],
        }),
        act('POST', 'RES.A.add_part', '/inventory/repair-orders/{id}/parts', {
          fields: [
            req(rf.lookup('stock_item_id', 'stockItems')),
            req(rf.decimal('quantity')),
            req(rf.uuid('source_bin_id')),
            rf.uuid('lot_id'),
          ],
        }),
        act('POST', 'RES.A.invoice_repair', '/inventory/repair-orders/{id}/invoice', {
          fields: [req(rf.decimal('tax_rate')), rf.date('date'), rf.text('currency')],
          showResult: true,
        }),
      ],
    },
    {
      id: 'warranty',
      titleKey: 'RES.P.warranty',
      module: 'inventory',
      list: {
        path: '/inventory/warranties/lookup',
        report: true,
        manual: true,
        filters: [req(rf.text('serial_number'))],
        columns: [],
      },
      toolbar: [
        act('PUT', 'RES.A.set_warranty', '/inventory/serials/{id}/warranty', {
          fields: [
            SERIAL_ID,
            req(rf.uuid('contact_id')),
            rf.datetime('purchase_date'),
            rf.decimal('purchase_value'),
            rf.text('purchase_currency'),
            req(rf.datetime('warranty_start_date')),
            req(rf.datetime('warranty_end_date')),
            rf.textarea('warranty_terms'),
          ],
        }),
      ],
    },
    {
      id: 'weighbridge-vehicles',
      titleKey: 'RES.P.weighbridge_vehicles',
      module: 'inventory',
      list: { path: '/inventory/weighbridge/vehicles', columns: [...cols('license_plate', 'card_number', 'stored_tare_kg'), col('tare_recorded_on', 'date')] },
      create: act('POST', 'RES.A.new_vehicle', '/inventory/weighbridge/vehicles', {
        fields: [req(rf.text('license_plate')), rf.text('card_number'), rf.uuid('contact_id'), rf.decimal('stored_tare_kg'), rf.datetime('tare_recorded_on'), rf.textarea('notes')],
      }),
      toolbar: [
        act('POST', 'RES.A.record_reading', '/inventory/weighbridge/readings', {
          fields: [req(rf.text('device_code')), req(rf.decimal('weight_kg')), rf.bool('is_stable'), rf.datetime('read_at')],
        }),
      ],
    },
    {
      id: 'weighbridge-readings',
      titleKey: 'RES.P.weighbridge_readings',
      module: 'inventory',
      list: { path: '/inventory/weighbridge/readings/latest', report: true, manual: true, filters: [req(rf.text('device_code'))], columns: [] },
    },
    {
      id: 'weighbridge-tickets',
      titleKey: 'RES.P.weighbridge_tickets',
      module: 'inventory',
      list: {
        path: '/inventory/weighbridge/tickets',
        filters: [rf.text('status')],
        columns: [...cols('ticket_number', 'weighbridge_vehicle_id'), tagCol('direction'), tagCol('status'), ...cols('gross_weight_kg', 'tare_weight_kg', 'net_weight_kg')],
      },
      create: act('POST', 'RES.A.first_weighing', '/inventory/weighbridge/tickets', {
        fields: [
          req(rf.uuid('weighbridge_vehicle_id')),
          req(rf.select('direction', ['inbound', 'outbound'])),
          rf.uuid('contact_id'),
          rf.lookup('stock_item_id', 'stockItems'),
          rf.decimal('weight_kg'),
          rf.uuid('reading_id'),
          rf.bool('use_stored_tare'),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.second_weighing', '/inventory/weighbridge/tickets/{id}/second-weighing', {
          fields: [
            req(rf.uuid('weighbridge_vehicle_id')),
            req(rf.select('direction', ['inbound', 'outbound'])),
            rf.decimal('weight_kg'),
            rf.uuid('reading_id'),
            rf.bool('use_stored_tare'),
          ],
        }),
        act('POST', 'RES.A.bill_ticket', '/inventory/weighbridge/tickets/{id}/bill', {
          fields: [req(rf.uuid('delivery_note_item_id')), req(rf.select('billing_uom', ['kg', 't', 'm3'])), rf.decimal('density_kg_m3')],
        }),
      ],
    },
    {
      id: 'safety-sheets',
      titleKey: 'RES.P.safety_sheets',
      module: 'inventory',
      list: { path: '/inventory/safety-sheets', filters: [rf.uuid('product_id')], columns: [...cols('title', 'language', 'product_id')] },
      create: act('POST', 'RES.A.new_safety_sheet', '/inventory/safety-sheets', {
        fields: [req(rf.uuid('product_id')), req(rf.text('language', { maxLength: 8 })), req(rf.text('title'))],
      }),
      rowActions: [act('GET', 'RES.A.versions', '/inventory/safety-sheets/{id}/versions', { showResult: true })],
      toolbar: [
        act('GET', 'RES.A.sheet_file', '/inventory/safety-sheets/versions/{versionId}/file', {
          download: true,
          fields: [req(rf.uuid('versionId', { labelKey: 'RES.F.version_id' }))],
        }),
        act('GET', 'RES.A.delivery_sheets', '/inventory/safety-sheets/deliveries/{deliveryNoteId}', {
          showResult: true,
          fields: [req(rf.uuid('deliveryNoteId', { labelKey: 'RES.F.delivery_note_id' }))],
        }),
        act('POST', 'RES.A.send_delivery_sheets', '/inventory/safety-sheets/deliveries/{deliveryNoteId}/send', {
          showResult: true,
          fields: [req(rf.uuid('deliveryNoteId', { labelKey: 'RES.F.delivery_note_id' }))],
        }),
      ],
    },
  ],
};
