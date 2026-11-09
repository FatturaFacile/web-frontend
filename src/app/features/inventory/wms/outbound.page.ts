import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const SHIPMENT_STATUSES = ['booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'] as const;

const RESERVATION_FIELDS = [
  req(rf.lookup('stock_item_id', 'stockItems')),
  req(rf.lookup('warehouse_id', 'warehouses')),
  req(rf.decimal('quantity')),
  req(rf.text('source_type')),
  req(rf.uuid('source_id')),
  rf.lookup('warehouse_bin_id', 'bins', { dependsOn: 'warehouse_id' }),
  rf.uuid('lot_id'),
  rf.datetime('expires_at'),
];

const PICK_LIST_FIELDS = [
  req(rf.lookup('warehouse_id', 'warehouses')),
  rf.uuid('assigned_picker_user_id'),
  rf.text('origin_document_type'),
  rf.uuid('origin_document_id'),
  req(
    rf.lines(
      'items',
      [req(rf.lookup('stock_item_id', 'stockItems')), rf.decimal('quantity'), rf.uuid('lot_id'), rf.uuid('reservation_id')],
      { required: true },
    ),
  ),
];

const RECIPIENT_FIELDS = [
  req(rf.uuid('shipping_carrier_id')),
  rf.uuid('stock_packing_list_id'),
  rf.uuid('delivery_note_id'),
  rf.integer('packages_count', { min: 1 }),
  rf.decimal('gross_weight_kg'),
  req(rf.json('recipient', { defaultValue: '{"name":"","address":"","city":"","postal_code":"","country":""}' })),
];

/** Outbound flow: reservations, pick waves and lists, packing and shipping. */
export const OUTBOUND_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.OUTBOUND',
  tabs: [
    {
      id: 'reservations',
      titleKey: 'RES.P.reservations',
      module: 'inventory',
      list: {
        path: '/inventory/reservations',
        filters: [rf.lookup('warehouse_id', 'warehouses'), rf.lookup('stock_item_id', 'stockItems'), rf.text('status')],
        columns: [...cols('stock_item_id', 'warehouse_id', 'quantity'), tagCol('status'), ...cols('source_type'), col('expires_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_reservation', '/inventory/reservations', { fields: RESERVATION_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.release', '/inventory/reservations/{id}/release', {
          confirm: true,
          visible: whenIn('status', 'active', 'reserved'),
        }),
      ],
      toolbar: [
        act('POST', 'RES.A.reserve_order', '/inventory/sales-orders/{id}/reserve', {
          fields: [
            req(rf.uuid('id', { labelKey: 'RES.F.sales_order_id' })),
            req(rf.lookup('warehouse_id', 'warehouses')),
            rf.datetime('expires_at'),
          ],
          showResult: true,
        }),
        act('POST', 'RES.A.release_order', '/inventory/sales-orders/{id}/release-reservations', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.sales_order_id' }))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'waves',
      titleKey: 'RES.P.waves',
      module: 'inventory',
      detailPath: '/inventory/waves/{id}',
      list: {
        path: '/inventory/waves',
        columns: [...cols('wave_number', 'warehouse_id'), tagCol('status'), col('released_at', 'datetime'), col('completed_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_wave', '/inventory/waves', {
        fields: [
          req(rf.lookup('warehouse_id', 'warehouses')),
          req(rf.lookup('staging_bin_id', 'bins', { dependsOn: 'warehouse_id' })),
          req(rf.tags('sales_order_ids')),
          rf.uuid('assigned_picker_user_id'),
          rf.textarea('notes'),
        ],
      }),
      rowActions: [
        act('POST', 'RES.ACTION.CANCEL', '/inventory/waves/{id}/cancel', {
          confirm: true,
          danger: true,
          visible: (row) => !['completed', 'cancelled'].includes(String(row['status'])),
        }),
      ],
    },
    {
      id: 'pick-lists',
      titleKey: 'RES.P.pick_lists',
      module: 'inventory',
      detailPath: '/inventory/pick-lists/{id}',
      list: {
        path: '/inventory/pick-lists',
        filters: [rf.lookup('warehouse_id', 'warehouses'), rf.text('status')],
        columns: [...cols('pick_list_number', 'warehouse_id'), tagCol('status'), col('completed_at', 'datetime'), col('shipped_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_pick_list', '/inventory/pick-lists', { fields: PICK_LIST_FIELDS }),
      rowActions: [
        act('GET', 'RES.A.next_stop', '/inventory/pick-lists/{id}/next-stop', { showResult: true }),
        act('POST', 'RES.A.confirm_line', '/inventory/pick-lists/{id}/lines/{lineId}/confirm', {
          fields: [
            req(rf.uuid('lineId', { labelKey: 'RES.F.line_id' })),
            req(rf.decimal('quantity')),
            rf.uuid('destination_bin_id'),
          ],
        }),
        act('POST', 'RES.A.ship_creates_ddt', '/inventory/pick-lists/{id}/ship', { confirm: true, showResult: true }),
        act('POST', 'RES.A.packing_list', '/inventory/pick-lists/{id}/packing-list', {
          fields: [rf.uuid('delivery_note_id')],
          showResult: true,
        }),
        act('POST', 'RES.ACTION.CANCEL', '/inventory/pick-lists/{id}/cancel', { confirm: true, danger: true }),
      ],
      toolbar: [
        act('POST', 'RES.A.calculate_packing', '/inventory/packing/calculate', {
          fields: [req(rf.lines('items', [req(rf.lookup('stock_item_id', 'stockItems')), req(rf.decimal('quantity'))], { required: true }))],
          showResult: true,
        }),
        act('GET', 'RES.A.view_packing_list', '/inventory/packing-lists/{id}', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.packing_list_id' }))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'carriers',
      titleKey: 'RES.P.carriers',
      module: 'inventory',
      list: { path: '/inventory/carriers', columns: [...cols('code', 'name'), tagCol('driver'), col('contract_number'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_carrier', '/inventory/carriers', {
        fields: [
          req(rf.text('code')),
          req(rf.text('name')),
          req(rf.select('driver', ['local', 'dpd_ch'])),
          rf.text('contract_number'),
          rf.json('credentials'),
          rf.text('tracking_url_template'),
        ],
      }),
      toolbar: [
        act('POST', 'RES.A.new_shipment', '/inventory/shipments', { fields: RECIPIENT_FIELDS, showResult: true }),
        act('GET', 'RES.A.view_shipment', '/inventory/shipments/{id}', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.shipment_id' }))],
          showResult: true,
        }),
        act('GET', 'RES.A.shipment_label', '/inventory/shipments/{id}/label', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.shipment_id' }))],
          download: true,
        }),
        act('POST', 'RES.A.add_tracking', '/inventory/shipments/{id}/tracking', {
          fields: [
            req(rf.uuid('id', { labelKey: 'RES.F.shipment_id' })),
            req(rf.select('status', SHIPMENT_STATUSES)),
            rf.datetime('occurred_at'),
            rf.text('description'),
            rf.text('location'),
          ],
        }),
        act('POST', 'RES.A.refresh_tracking', '/inventory/shipments/{id}/refresh', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.shipment_id' }))],
          showResult: true,
        }),
      ],
    },
  ],
};
