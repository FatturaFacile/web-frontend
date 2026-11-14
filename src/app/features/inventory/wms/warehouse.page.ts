import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const WAREHOUSE_SCOPE = req(rf.lookup('warehouse_id', 'warehouses'));
const ZONE_TYPES = ['receiving', 'storage', 'picking', 'packing', 'shipping', 'quarantine', 'transit'] as const;
const BIN_TYPES = ['storage', 'picking', 'bulk', 'receiving', 'staging', 'shipping', 'quarantine', 'transit'] as const;
const STRATEGIES = ['fixed_location', 'consolidate', 'empty_bin'] as const;

const SUGGEST_FIELDS = [
  rf.lookup('warehouse_id', 'warehouses'),
  req(rf.lookup('source_bin_id', 'bins', { dependsOn: 'warehouse_id' })),
  rf.lookup('destination_bin_id', 'bins', { dependsOn: 'warehouse_id' }),
  req(rf.lookup('stock_item_id', 'stockItems')),
  rf.uuid('lot_id'),
  req(rf.decimal('quantity')),
  rf.integer('limit', { min: 1 }),
];

const PUTAWAY_RULE_FIELDS = [
  req(rf.lookup('warehouse_id', 'warehouses')),
  rf.lookup('stock_item_id', 'stockItems'),
  rf.uuid('category_id'),
  rf.lookup('target_zone_id', 'zones', { dependsOn: 'warehouse_id' }),
  rf.lookup('target_bin_id', 'bins', { dependsOn: 'warehouse_id' }),
  rf.select('bin_type', ['storage', 'picking', 'bulk']),
  req(rf.select('strategy', STRATEGIES)),
  rf.integer('priority', { min: 0 }),
  rf.bool('is_active', { defaultValue: true }),
];

/** Warehouse structure (zones, bins, occupancy) and putaway rules. */
export const WAREHOUSE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.WAREHOUSE',
  tabs: [
    {
      id: 'zones',
      titleKey: 'RES.P.zones',
      module: 'inventory',
      list: {
        path: '/inventory/warehouses/{warehouse_id}/zones',
        scope: WAREHOUSE_SCOPE,
        columns: [...cols('code', 'name'), tagCol('zone_type'), col('bins_count')],
      },
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/inventory/zones/{id}', {
          prefill: true,
          fields: [rf.text('name', { maxLength: 100 }), rf.select('zone_type', ZONE_TYPES)],
        }),
      ],
    },
    {
      id: 'bins',
      titleKey: 'RES.P.bins',
      module: 'inventory',
      list: {
        path: '/inventory/warehouses/{warehouse_id}/bins',
        scope: WAREHOUSE_SCOPE,
        columns: [
          ...cols('code', 'zone_code', 'aisle_code', 'rack_code'),
          tagCol('bin_type'),
          col('pick_sequence'),
          col('is_locked', 'bool'),
          col('occupancy.quantity', undefined, 'RES.F.occupancy_quantity'),
          col('occupancy.items', undefined, 'RES.F.occupancy_items'),
          col('max_quantity'),
        ],
      },
      toolbar: [
        act('POST', 'RES.A.create_location', '/inventory/warehouses/{warehouse_id}/locations', {
          fields: [
            req(rf.text('zone_code', { maxLength: 50 })),
            rf.text('zone_name', { maxLength: 100 }),
            rf.select('zone_type', ZONE_TYPES),
            req(rf.text('aisle_code', { maxLength: 50 })),
            req(rf.text('rack_code', { maxLength: 50 })),
            req(rf.text('bin_code', { maxLength: 50 })),
            req(rf.text('barcode', { maxLength: 100 })),
            rf.integer('pick_sequence'),
            rf.decimal('max_weight_kg'),
            rf.decimal('max_volume_cbm'),
            rf.decimal('max_quantity'),
            rf.select('bin_type', BIN_TYPES),
          ],
        }),
      ],
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/inventory/bins/{id}', {
          prefill: true,
          fields: [
            rf.select('bin_type', BIN_TYPES),
            rf.decimal('max_quantity'),
            rf.decimal('max_weight_kg'),
            rf.decimal('max_volume_cbm'),
            rf.bool('is_locked'),
            rf.integer('pick_sequence'),
          ],
        }),
      ],
    },
    {
      id: 'putaway-rules',
      titleKey: 'RES.P.putaway_rules',
      module: 'inventory',
      list: {
        path: '/inventory/putaway-rules',
        columns: [
          col('warehouse_id'),
          col('stock_item_id'),
          col('target_bin_id'),
          tagCol('bin_type'),
          tagCol('strategy'),
          col('priority'),
          col('is_active', 'bool'),
        ],
      },
      create: act('POST', 'RES.A.new_rule', '/inventory/putaway-rules', { fields: PUTAWAY_RULE_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/inventory/putaway-rules/{id}', { prefill: true, fields: PUTAWAY_RULE_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/inventory/putaway-rules/{id}', { confirm: true, danger: true }),
      ],
      toolbar: [
        act('POST', 'RES.A.suggest_putaway', '/inventory/putaway/suggest', { fields: SUGGEST_FIELDS, showResult: true }),
        act('POST', 'RES.A.execute_putaway', '/inventory/putaway', { fields: SUGGEST_FIELDS, showResult: true }),
      ],
    },
  ],
};
