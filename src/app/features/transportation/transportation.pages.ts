import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';
import { TMS_AUDIT_STATUSES, TMS_CARRIER_MODES, TMS_DISPUTE_STATUSES, TMS_ORDER_STATUSES, TMS_RATE_BASES, TMS_TRACKING_EVENT_TYPES, TMS_TRIP_STATUSES } from '@core';

const ACTIVE = rf.bool('is_active', { defaultValue: true });
const CARRIER = req(rf.uuid('carrier_id'));
const CURRENCY = rf.text('currency', { maxLength: 3, defaultValue: 'EUR' });
const edit = (path: string, fields: ReturnType<typeof rf.text>[]) => act('PUT', 'RES.ACTION.EDIT', path, { prefill: true, fields });
const remove = (path: string, visible?: (row: Record<string, unknown>) => boolean) => act('DELETE', 'RES.ACTION.DELETE', path, { confirm: true, danger: true, visible });

const carrierFields = [
  req(rf.text('code', { maxLength: 30 })),
  req(rf.text('name', { maxLength: 160 })),
  rf.select('mode', TMS_CARRIER_MODES, { defaultValue: 'road' }),
  rf.text('service_level', { maxLength: 60 }),
  CURRENCY,
  ACTIVE,
  rf.textarea('notes', { maxLength: 5000 }),
];
const tableFields = (create: boolean) => [
  ...(create ? [CARRIER] : []),
  req(rf.text('name', { maxLength: 160 })),
  CURRENCY,
  req(rf.date('valid_from')),
  rf.date('valid_to', { notBefore: 'valid_from' }),
  rf.select('rate_basis', TMS_RATE_BASES, { defaultValue: 'weight' }),
  rf.decimal('fuel_surcharge_percent', { min: 0, max: 100, defaultValue: '0' }),
  rf.decimal('minimum_charge', { min: 0, defaultValue: '0' }),
  ACTIVE,
  rf.textarea('notes', { maxLength: 5000 }),
];
const bandFields = (create: boolean) => [
  ...(create ? [req(rf.uuid('tariff_table_id'))] : []),
  rf.text('origin_zone', { maxLength: 30 }),
  rf.text('destination_zone', { maxLength: 30 }),
  rf.decimal('weight_from_kg', { min: 0, defaultValue: '0' }),
  rf.decimal('weight_to_kg', { min: 0 }),
  rf.decimal('distance_from_km', { min: 0, defaultValue: '0' }),
  rf.decimal('distance_to_km', { min: 0 }),
  rf.decimal('fixed_amount', { min: 0, defaultValue: '0' }),
  rf.decimal('price_per_kg', { min: 0, defaultValue: '0' }),
  rf.decimal('price_per_km', { min: 0, defaultValue: '0' }),
];

/** Carriers with their tariff tables and the weight, distance and zone bands that price a shipment. */
export const TMS_CARRIERS_PAGE: ResourcePageConfig = {
  titleKey: 'TMS.PAGE_CARRIERS',
  tabs: [
    {
      id: 'carriers',
      titleKey: 'TMS.TAB_CARRIERS',
      module: 'transportation',
      detailPath: '/transportation/carriers/{id}',
      rowLink: { labelKey: 'TMS.OPEN_DETAIL', route: '/transportation/carriers/{id}' },
      list: { path: '/transportation/carriers', columns: [...cols('code', 'name'), tagCol('mode'), col('currency'), col('is_active', 'bool')], filters: [rf.select('mode', TMS_CARRIER_MODES), rf.bool('is_active')] },
      create: act('POST', 'TMS.ACTION_NEW_CARRIER', '/transportation/carriers', { fields: carrierFields }),
      rowActions: [edit('/transportation/carriers/{id}', carrierFields), remove('/transportation/carriers/{id}')],
    },
    {
      id: 'tariff-tables',
      titleKey: 'TMS.TAB_TARIFF_TABLES',
      module: 'transportation',
      detailPath: '/transportation/tariff-tables/{id}',
      rowLink: { labelKey: 'TMS.OPEN_DETAIL', route: '/transportation/tariffs/{id}' },
      list: { path: '/transportation/tariff-tables', columns: [col('carrier.name'), ...cols('name'), tagCol('rate_basis'), col('valid_from', 'date'), col('valid_to', 'date'), col('fuel_surcharge_percent', 'decimal'), col('minimum_charge', 'decimal'), col('is_active', 'bool')], filters: [rf.uuid('carrier_id'), rf.select('rate_basis', TMS_RATE_BASES)] },
      create: act('POST', 'TMS.ACTION_NEW_TARIFF_TABLE', '/transportation/tariff-tables', { fields: tableFields(true) }),
      rowActions: [edit('/transportation/tariff-tables/{id}', tableFields(false)), remove('/transportation/tariff-tables/{id}')],
    },
    {
      id: 'tariff-bands',
      titleKey: 'TMS.TAB_TARIFF_BANDS',
      module: 'transportation',
      detailPath: '/transportation/tariff-bands/{id}',
      rowLink: { labelKey: 'TMS.OPEN_BANDS_EDITOR', route: '/transportation/tariffs/{tariff_table_id}' },
      list: { path: '/transportation/tariff-bands', columns: [...cols('origin_zone', 'destination_zone'), col('weight_from_kg', 'decimal'), col('weight_to_kg', 'decimal'), col('distance_from_km', 'decimal'), col('distance_to_km', 'decimal'), col('fixed_amount', 'decimal'), col('price_per_kg', 'decimal'), col('price_per_km', 'decimal')], filters: [rf.uuid('tariff_table_id'), rf.text('origin_zone'), rf.text('destination_zone')] },
      create: act('POST', 'TMS.ACTION_NEW_TARIFF_BAND', '/transportation/tariff-bands', { fields: bandFields(true) }),
      rowActions: [edit('/transportation/tariff-bands/{id}', bandFields(false)), remove('/transportation/tariff-bands/{id}')],
    },
    {
      id: 'rate',
      titleKey: 'TMS.TAB_RATE_CALCULATOR',
      module: 'transportation',
      list: { path: '', columns: [] },
      toolbar: [act('POST', 'TMS.ACTION_CALCULATE_RATE', '/transportation/rates/calculate', {
        fields: [CARRIER, req(rf.decimal('weight_kg', { positive: true })), rf.decimal('distance_km', { min: 0 }), rf.text('origin_zone', { maxLength: 30 }), rf.text('destination_zone', { maxLength: 30 }), rf.date('date'), rf.text('currency', { maxLength: 3 })],
        showResult: true,
      })],
    },
  ],
};

const orderFields = [
  rf.text('reference', { maxLength: 100 }),
  req(rf.text('origin_name', { maxLength: 160 })),
  req(rf.text('origin_location', { maxLength: 255 })),
  rf.text('origin_city', { maxLength: 100 }),
  rf.text('origin_zone', { maxLength: 30 }),
  req(rf.text('destination_name', { maxLength: 160 })),
  req(rf.text('destination_location', { maxLength: 255 })),
  rf.text('destination_city', { maxLength: 100 }),
  rf.text('destination_zone', { maxLength: 30 }),
  rf.datetime('pickup_from'),
  rf.datetime('pickup_to', { notBefore: 'pickup_from' }),
  rf.datetime('delivery_from'),
  rf.datetime('delivery_to', { notBefore: 'delivery_from' }),
  req(rf.decimal('weight_kg', { positive: true })),
  rf.decimal('volume_cbm', { min: 0, defaultValue: '0' }),
  rf.integer('pallets', { min: 0, defaultValue: 0 }),
  rf.decimal('distance_km', { min: 0 }),
  rf.text('goods_description', { maxLength: 255 }),
  CURRENCY,
  rf.textarea('notes', { maxLength: 5000 }),
];

/** Transport orders with their tracking events. */
export const TMS_ORDERS_PAGE: ResourcePageConfig = {
  titleKey: 'TMS.PAGE_ORDERS',
  tabs: [
    {
      id: 'orders',
      titleKey: 'TMS.TAB_ORDERS',
      module: 'transportation',
      detailPath: '/transportation/transport-orders/{id}',
      rowLink: { labelKey: 'TMS.OPEN_DETAIL', route: '/transportation/orders/{id}' },
      list: { path: '/transportation/transport-orders', columns: [...cols('number', 'reference', 'origin_city', 'destination_city'), tagCol('status'), col('carrier.name'), col('weight_kg', 'decimal'), col('expected_cost', 'decimal'), col('delivery_to', 'datetime'), col('is_on_time', 'bool')], filters: [rf.select('status', TMS_ORDER_STATUSES), rf.uuid('carrier_id'), rf.text('search')] },
      create: act('POST', 'TMS.ACTION_NEW_ORDER', '/transportation/transport-orders', { fields: orderFields }),
      rowActions: [
        edit('/transportation/transport-orders/{id}', orderFields),
        act('POST', 'TMS.ACTION_PLAN', '/transportation/transport-orders/{id}/plan', { visible: whenIn('status', 'draft') }),
        act('POST', 'TMS.ACTION_ASSIGN_CARRIER', '/transportation/transport-orders/{id}/assign-carrier', { fields: [CARRIER, rf.decimal('expected_cost', { min: 0 })], visible: whenIn('status', 'draft', 'planned') }),
        act('POST', 'TMS.ACTION_CANCEL', '/transportation/transport-orders/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'draft', 'planned') }),
        remove('/transportation/transport-orders/{id}', whenIn('status', 'draft', 'cancelled')),
      ],
    },
    {
      id: 'tracking',
      rowLink: { labelKey: 'TMS.OPEN_ORDER', route: '/transportation/orders/{transport_order_id}' },
      titleKey: 'TMS.TAB_TRACKING',
      module: 'transportation',
      detailPath: '/transportation/tracking-events/{id}',
      list: { path: '/transportation/tracking-events', columns: [tagCol('event_type'), ...cols('location'), col('occurred_at', 'datetime'), ...cols('notes')], filters: [rf.uuid('transport_order_id'), rf.select('event_type', TMS_TRACKING_EVENT_TYPES), rf.date('from'), rf.date('to')] },
      create: act('POST', 'TMS.ACTION_NEW_EVENT', '/transportation/tracking-events', {
        fields: [req(rf.uuid('transport_order_id')), req(rf.select('event_type', TMS_TRACKING_EVENT_TYPES)), rf.text('location', { maxLength: 160 }), req(rf.datetime('occurred_at')), rf.textarea('notes', { maxLength: 5000 })],
      }),
    },
  ],
};

const tripFields = [
  rf.uuid('carrier_id'),
  rf.uuid('vehicle_id'),
  rf.datetime('planned_start_at'),
  rf.datetime('planned_end_at', { notBefore: 'planned_start_at' }),
  rf.decimal('capacity_weight_kg', { positive: true }),
  rf.decimal('capacity_volume_cbm', { positive: true }),
  rf.decimal('planned_distance_km', { min: 0 }),
  CURRENCY,
  rf.textarea('notes', { maxLength: 5000 }),
];

/** Trips: consolidation of orders within the capacity, stops, dispatch and completion. */
export const TMS_TRIPS_PAGE: ResourcePageConfig = {
  titleKey: 'TMS.PAGE_TRIPS',
  tabs: [
    {
      id: 'trips',
      titleKey: 'TMS.TAB_TRIPS',
      module: 'transportation',
      detailPath: '/transportation/trips/{id}',
      rowLink: { labelKey: 'TMS.OPEN_DETAIL', route: '/transportation/trips/{id}' },
      list: { path: '/transportation/trips', columns: [...cols('number'), tagCol('status'), col('carrier.name'), col('planned_start_at', 'datetime'), col('total_weight_kg', 'decimal'), col('utilization_percent', 'decimal'), col('actual_distance_km', 'decimal'), col('actual_cost', 'decimal')], filters: [rf.select('status', TMS_TRIP_STATUSES), rf.uuid('carrier_id'), rf.date('from'), rf.date('to')] },
      create: act('POST', 'TMS.ACTION_NEW_TRIP', '/transportation/trips', { fields: tripFields }),
      rowActions: [
        edit('/transportation/trips/{id}', tripFields),
        act('POST', 'TMS.ACTION_ADD_ORDERS', '/transportation/trips/{id}/orders', { fields: [req(rf.tags('order_ids'))], visible: whenIn('status', 'planned', 'dispatched') }),
        act('DELETE', 'RES.A.tms_remove_trip_order', '/transportation/trips/{id}/orders/{orderId}', {
          fields: [req(rf.uuid('orderId', { labelKey: 'RES.F.order_id' }))],
          confirm: true,
          danger: true,
          visible: whenIn('status', 'planned', 'dispatched'),
        }),
        act('POST', 'TMS.ACTION_DISPATCH', '/transportation/trips/{id}/dispatch', { visible: whenIn('status', 'planned') }),
        act('POST', 'TMS.ACTION_START', '/transportation/trips/{id}/start', { visible: whenIn('status', 'dispatched') }),
        act('POST', 'TMS.ACTION_COMPLETE', '/transportation/trips/{id}/complete', { fields: [rf.decimal('actual_distance_km', { positive: true }), rf.decimal('actual_cost', { min: 0 })], visible: whenIn('status', 'in_progress') }),
        act('POST', 'TMS.ACTION_CANCEL', '/transportation/trips/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'planned', 'dispatched') }),
        remove('/transportation/trips/{id}', whenIn('status', 'planned')),
      ],
    },
  ],
};

/** Freight quotes comparison across carriers. */
export const TMS_QUOTES_PAGE: ResourcePageConfig = {
  titleKey: 'TMS.PAGE_QUOTES',
  tabs: [
    {
      id: 'quotes',
      titleKey: 'TMS.TAB_QUOTES',
      module: 'transportation',
      detailPath: '/transportation/quotes/{id}',
      list: { path: '/transportation/quotes', columns: [...cols('reference'), col('ship_date', 'date'), col('weight_kg', 'decimal'), col('distance_km', 'decimal'), tagCol('status'), col('awarded_amount', 'decimal')], filters: [rf.select('status', ['open', 'awarded', 'cancelled']), rf.date('from'), rf.date('to')] },
      create: act('POST', 'TMS.ACTION_COMPARE', '/transportation/quotes', {
        fields: [rf.text('reference', { maxLength: 100 }), rf.uuid('transport_order_id'), rf.decimal('weight_kg', { positive: true }), rf.decimal('distance_km', { min: 0 }), rf.text('origin_zone', { maxLength: 30 }), rf.text('destination_zone', { maxLength: 30 }), rf.date('ship_date'), rf.text('currency', { maxLength: 3 }), rf.textarea('notes', { maxLength: 2000 })],
      }),
      rowActions: [
        act('POST', 'TMS.ACTION_AWARD', '/transportation/quotes/{id}/award', { fields: [CARRIER], visible: whenIn('status', 'open') }),
        remove('/transportation/quotes/{id}', whenIn('status', 'open', 'cancelled')),
      ],
    },
  ],
};

const invoiceFields = (create: boolean) => [
  ...(create ? [CARRIER] : []),
  req(rf.text('invoice_number', { maxLength: 60 })),
  req(rf.date('invoice_date')),
  CURRENCY,
  rf.textarea('notes', { maxLength: 5000 }),
  rf.lines('lines', [rf.uuid('transport_order_id'), rf.text('description', { maxLength: 255 }), req(rf.decimal('billed_amount', { min: 0 }))], { required: create }),
];

/** Freight invoice audit: carrier invoices against the expected rate, with variance and disputes. */
export const TMS_AUDIT_PAGE: ResourcePageConfig = {
  titleKey: 'TMS.PAGE_AUDIT',
  tabs: [
    {
      id: 'invoices',
      titleKey: 'TMS.TAB_INVOICES',
      module: 'transportation',
      detailPath: '/transportation/freight-invoices/{id}',
      list: { path: '/transportation/freight-invoices', columns: [...cols('invoice_number'), col('carrier.name'), col('invoice_date', 'date'), col('total_amount', 'decimal'), col('expected_total', 'decimal'), col('variance_amount', 'decimal'), tagCol('audit_status'), tagCol('dispute_status')], filters: [rf.uuid('carrier_id'), rf.select('audit_status', TMS_AUDIT_STATUSES), rf.select('dispute_status', TMS_DISPUTE_STATUSES), rf.date('from'), rf.date('to'), rf.text('search')] },
      create: act('POST', 'TMS.ACTION_NEW_INVOICE', '/transportation/freight-invoices', { fields: invoiceFields(true) }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/transportation/freight-invoices/{id}', { prefill: true, fields: invoiceFields(false), visible: whenIn('dispute_status', 'none') }),
        act('POST', 'TMS.ACTION_AUDIT', '/transportation/freight-invoices/{id}/audit', { fields: [rf.decimal('tolerance_percent', { min: 0, max: 100 })], visible: whenIn('dispute_status', 'none', 'open') }),
        act('POST', 'TMS.ACTION_DISPUTE', '/transportation/freight-invoices/{id}/dispute', { fields: [req(rf.textarea('reason', { maxLength: 2000 }))], visible: (row) => row['dispute_status'] === 'none' && ['over_billed', 'under_billed', 'unmatched'].includes(String(row['audit_status'])) }),
        act('POST', 'TMS.ACTION_RESOLVE_DISPUTE', '/transportation/freight-invoices/{id}/resolve-dispute', { fields: [req(rf.select('resolution', ['accepted', 'credited', 'rejected'])), req(rf.textarea('note', { maxLength: 2000 })), rf.decimal('credited_amount', { positive: true })], visible: whenIn('dispute_status', 'open') }),
        remove('/transportation/freight-invoices/{id}', whenIn('dispute_status', 'none')),
      ],
    },
  ],
};
