import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const ITEM_TYPES = ['raw_material', 'subassembly', 'finished_good', 'phantom'] as const;
const PROCUREMENT_TYPES = ['make', 'buy', 'subcontract'] as const;
const ISSUE_METHODS = ['manual', 'backflush'] as const;

const ITEM_FIELDS = [
  req(rf.text('item_code')),
  req(rf.text('name')),
  rf.textarea('description'),
  req(rf.select('item_type', ITEM_TYPES)),
  rf.select('procurement_type', PROCUREMENT_TYPES),
  rf.uuid('stock_item_id'),
  rf.uuid('product_id'),
  rf.lookup('default_warehouse_id', 'warehouses'),
  rf.text('uom'),
  rf.decimal('standard_cost'),
  rf.decimal('safety_stock'),
  rf.decimal('min_lot_size'),
  rf.decimal('max_lot_size'),
  rf.decimal('lot_size_multiple'),
  rf.integer('lead_time_days', { min: 0 }),
  rf.bool('is_active', { defaultValue: true }),
];

const BOM_COMPONENT = [
  req(rf.lookup('component_item_id', 'mfgItems')),
  req(rf.decimal('quantity_per')),
  rf.integer('sequence'),
  rf.decimal('scrap_percentage'),
  rf.decimal('yield_percentage'),
  rf.bool('is_phantom'),
  rf.select('issue_method', ISSUE_METHODS),
  rf.integer('operation_sequence'),
];

const BOM_FIELDS = [
  req(rf.lookup('mfg_item_id', 'mfgItems')),
  req(rf.text('name')),
  rf.text('revision'),
  rf.select('bom_type', ['standard', 'phantom', 'engineering']),
  rf.decimal('base_quantity'),
  rf.text('uom'),
  rf.datetime('effective_from'),
  rf.datetime('effective_to', { notBefore: 'effective_from' }),
  rf.textarea('notes'),
  req(rf.lines('components', BOM_COMPONENT, { required: true })),
];

const ROUTING_FIELDS = [
  req(rf.lookup('mfg_item_id', 'mfgItems')),
  req(rf.text('name')),
  rf.text('revision'),
  rf.bool('is_default'),
  rf.datetime('effective_from'),
  rf.datetime('effective_to', { notBefore: 'effective_from' }),
  rf.textarea('notes'),
  req(
    rf.lines(
      'operations',
      [
        rf.integer('sequence'),
        req(rf.text('operation_code')),
        req(rf.text('name')),
        req(rf.uuid('work_center_id')),
        rf.decimal('setup_time_minutes'),
        rf.decimal('run_time_minutes_per_unit'),
        rf.decimal('labor_time_minutes_per_unit'),
        rf.bool('is_subcontracted'),
        rf.uuid('subcontractor_contact_id'),
        rf.decimal('subcontract_unit_cost'),
      ],
      { required: true },
    ),
  ),
];

const WORK_CENTER_FIELDS = [
  req(rf.text('work_center_code')),
  req(rf.text('name')),
  rf.textarea('description'),
  rf.text('department_code'),
  rf.decimal('capacity_hours_per_day'),
  rf.decimal('efficiency_rate'),
  rf.decimal('availability_rate'),
  rf.decimal('hourly_cost_rate'),
  rf.decimal('hourly_overhead_rate'),
  rf.select('status', ['active', 'inactive']),
];

const ECO_FIELDS = [
  req(rf.uuid('bom_id')),
  req(rf.text('title')),
  req(rf.textarea('reason')),
  rf.textarea('description'),
  rf.select('change_type', ['bom_change', 'component_substitution', 'quantity_change']),
  rf.datetime('effective_date'),
  rf.text('new_revision'),
  req(
    rf.lines(
      'components',
      [
        req(rf.select('action', ['add', 'update', 'remove'])),
        req(rf.uuid('component_item_id')),
        rf.decimal('quantity_per'),
        rf.decimal('scrap_percentage'),
        rf.decimal('yield_percentage'),
        rf.bool('is_phantom'),
        rf.select('issue_method', ISSUE_METHODS),
        rf.integer('operation_sequence'),
      ],
      { required: true },
    ),
  ),
];

/** Item master, BOM revisions, routings, work centres and engineering changes. */
export const MFG_ENGINEERING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.MFG_ENGINEERING',
  tabs: [
    {
      id: 'items',
      titleKey: 'RES.P.mfg_items',
      module: 'manufacturing',
      detailPath: '/manufacturing/items/{id}',
      list: {
        path: '/manufacturing/items',
        filters: [rf.select('active', ['true', 'false'])],
        columns: [...cols('item_code', 'name'), tagCol('item_type'), tagCol('procurement_type'), ...cols('standard_cost', 'uom'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_mfg_item', '/manufacturing/items', { fields: ITEM_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/manufacturing/items/{id}', { prefill: true, fields: ITEM_FIELDS.filter((f) => f.key !== 'item_code') }),
        act('POST', 'RES.A.cost_rollup', '/manufacturing/items/{id}/cost-rollup', { fields: [rf.datetime('date')], showResult: true }),
        act('GET', 'RES.A.where_used', '/manufacturing/items/{id}/where-used', { showResult: true }),
      ],
    },
    {
      id: 'boms',
      titleKey: 'RES.P.boms',
      module: 'manufacturing',
      detailPath: '/manufacturing/boms/{id}',
      list: {
        path: '/manufacturing/boms',
        columns: [...cols('bom_number', 'name', 'revision'), tagCol('bom_type'), tagCol('status'), col('effective_from', 'date'), col('effective_to', 'date')],
      },
      create: act('POST', 'RES.A.new_bom', '/manufacturing/boms', { fields: BOM_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.activate', '/manufacturing/boms/{id}/activate', { confirm: true, visible: whenIn('status', 'draft') }),
        act('POST', 'RES.A.revise', '/manufacturing/boms/{id}/revise', {
          fields: [rf.text('new_revision', { maxLength: 20 }), req(rf.textarea('reason', { maxLength: 1000 })), rf.datetime('effective_from')],
          showResult: true,
          visible: whenIn('status', 'active', 'released'),
        }),
        act('GET', 'RES.A.explode', '/manufacturing/boms/{id}/explode', { fields: [rf.decimal('quantity'), rf.date('date')], showResult: true }),
      ],
    },
    {
      id: 'routings',
      titleKey: 'RES.P.routings',
      module: 'manufacturing',
      detailPath: '/manufacturing/routings/{id}',
      list: { path: '/manufacturing/routings', columns: [...cols('routing_number', 'name', 'revision'), tagCol('status'), col('is_default', 'bool')] },
      create: act('POST', 'RES.A.new_routing', '/manufacturing/routings', { fields: ROUTING_FIELDS }),
    },
    {
      id: 'work-centers',
      titleKey: 'RES.P.work_centers',
      module: 'manufacturing',
      detailPath: '/manufacturing/work-centers/{id}',
      list: {
        path: '/manufacturing/work-centers',
        columns: [...cols('work_center_code', 'name', 'capacity_hours_per_day', 'efficiency_rate', 'availability_rate', 'hourly_cost_rate'), tagCol('status')],
      },
      create: act('POST', 'RES.A.new_work_center', '/manufacturing/work-centers', { fields: WORK_CENTER_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/manufacturing/work-centers/{id}', { prefill: true, fields: WORK_CENTER_FIELDS }),
        act('PUT', 'RES.A.edit_calendar', '/manufacturing/work-centers/{id}/calendar', {
          fields: [req(rf.lines('days', [req(rf.integer('weekday', { min: 0 })), req(rf.decimal('available_hours'))], { required: true }))],
        }),
        act('POST', 'RES.A.calendar_exception', '/manufacturing/work-centers/{id}/calendar-exceptions', {
          fields: [req(rf.datetime('calendar_date')), req(rf.decimal('available_hours')), rf.text('reason', { maxLength: 255 })],
        }),
        act('GET', 'RES.A.capacity', '/manufacturing/work-centers/{id}/capacity', {
          fields: [req(rf.datetime('from')), req(rf.datetime('to', { notBefore: 'from' }))],
          showResult: true,
        }),
      ],
    },
    {
      id: 'engineering-changes',
      titleKey: 'RES.P.engineering_changes',
      module: 'manufacturing',
      detailPath: '/manufacturing/engineering-changes/{id}',
      list: {
        path: '/manufacturing/engineering-changes',
        columns: [...cols('eco_number', 'title'), tagCol('change_type'), tagCol('status'), col('effective_date', 'date'), col('approved_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_eco', '/manufacturing/engineering-changes', { fields: ECO_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.submit', '/manufacturing/engineering-changes/{id}/submit', { confirm: true, visible: whenIn('status', 'draft') }),
        act('POST', 'RES.A.approve', '/manufacturing/engineering-changes/{id}/approve', { confirm: true, visible: whenIn('status', 'submitted') }),
        act('POST', 'RES.A.reject', '/manufacturing/engineering-changes/{id}/reject', {
          fields: [req(rf.textarea('reason', { maxLength: 1000 }))],
          danger: true,
          visible: whenIn('status', 'submitted'),
        }),
        act('POST', 'RES.A.implement', '/manufacturing/engineering-changes/{id}/implement', {
          confirm: true,
          showResult: true,
          visible: whenIn('status', 'approved'),
        }),
      ],
    },
  ],
};
