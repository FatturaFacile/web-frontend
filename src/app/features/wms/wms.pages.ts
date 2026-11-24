import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol, whenIn } from '@shared';
import { WMS_BIN_TYPES, WMS_DOCK_DIRECTIONS, WMS_TASK_STATUSES, WMS_TASK_TYPES } from '@core';

const WAREHOUSE = req(rf.lookup('warehouse_id', 'warehouses'));
const WAREHOUSE_FILTER = rf.lookup('warehouse_id', 'warehouses');
const ACTIVE = rf.bool('is_active', { defaultValue: true });
const CRUD = (path: string, create: ResourcePanelConfig['create']): Pick<ResourcePanelConfig, 'create' | 'detailPath'> => ({ create, detailPath: `${path}/{id}` });

/** The RF task queue and the waves that group its pick tasks. */
export const WMS_TASKS_PAGE: ResourcePageConfig = {
  titleKey: 'WMS.PAGE_TASKS',
  tabs: [
    {
      id: 'tasks',
      titleKey: 'WMS.TAB_TASKS',
      module: 'wms',
      list: {
        path: '/wms/tasks',
        columns: [tagCol('task_type'), tagCol('status'), col('priority'), col('stock_item.sku'), col('source_bin.code'), col('destination_bin.code'), col('planned_quantity', 'decimal'), col('confirmed_quantity', 'decimal'), col('due_at', 'datetime')],
        filters: [WAREHOUSE_FILTER, rf.select('task_type', WMS_TASK_TYPES), rf.select('status', WMS_TASK_STATUSES)],
      },
      ...CRUD('/wms/tasks', act('POST', 'WMS.ACTION_NEW_TASK', '/wms/tasks', {
        fields: [
          WAREHOUSE,
          req(rf.select('task_type', WMS_TASK_TYPES)),
          rf.integer('priority', { min: 0, max: 100, defaultValue: 50 }),
          rf.lookup('stock_item_id', 'stockItems'),
          rf.lookup('source_bin_id', 'bins', { dependsOn: 'warehouse_id' }),
          rf.lookup('destination_bin_id', 'bins', { dependsOn: 'warehouse_id' }),
          req(rf.decimal('planned_quantity', { positive: true })),
          rf.text('reference', { maxLength: 100 }),
          rf.datetime('due_at'),
          rf.textarea('notes', { maxLength: 5000 }),
        ],
      })),
      toolbar: [act('POST', 'WMS.ACTION_CLAIM_NEXT', '/wms/tasks/claim-next', { showResult: true })],
      rowActions: [
        act('POST', 'WMS.ACTION_ASSIGN', '/wms/tasks/{id}/assign', { fields: [req(rf.uuid('user_id'))], visible: whenIn('status', 'open', 'assigned') }),
        act('POST', 'WMS.ACTION_START', '/wms/tasks/{id}/start', { visible: whenIn('status', 'open', 'assigned') }),
        act('POST', 'WMS.ACTION_CONFIRM', '/wms/tasks/{id}/confirm', { visible: whenIn('status', 'in_progress') }),
        act('POST', 'WMS.ACTION_SHORT', '/wms/tasks/{id}/short', { fields: [req(rf.decimal('quantity', { min: 0 })), req(rf.text('reason', { maxLength: 255 }))], visible: whenIn('status', 'in_progress') }),
        act('POST', 'WMS.ACTION_SKIP', '/wms/tasks/{id}/skip', { fields: [req(rf.text('reason', { maxLength: 255 }))], visible: whenIn('status', 'open', 'assigned', 'in_progress') }),
        act('POST', 'WMS.ACTION_CANCEL', '/wms/tasks/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'open', 'assigned', 'in_progress') }),
        act('DELETE', 'RES.ACTION.DELETE', '/wms/tasks/{id}', { confirm: true, danger: true, visible: whenIn('status', 'open', 'cancelled') }),
      ],
    },
    {
      id: 'waves',
      titleKey: 'WMS.TAB_WAVES',
      module: 'wms',
      list: { path: '/wms/waves', columns: [...cols('number'), tagCol('status'), col('task_count'), col('released_at', 'datetime'), col('completed_at', 'datetime')], filters: [WAREHOUSE_FILTER, rf.select('status', ['planned', 'released', 'completed', 'cancelled'])] },
      toolbar: [act('POST', 'WMS.ACTION_PLAN_WAVE', '/wms/waves/plan', { fields: [req(rf.uuid('wave_rule_id'))] })],
      rowActions: [
        act('POST', 'WMS.ACTION_RELEASE', '/wms/waves/{id}/release', { visible: whenIn('status', 'planned') }),
        act('POST', 'WMS.ACTION_COMPLETE', '/wms/waves/{id}/complete', { visible: whenIn('status', 'released') }),
        act('POST', 'WMS.ACTION_CANCEL', '/wms/waves/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'planned', 'released') }),
      ],
    },
    {
      id: 'wave-rules',
      titleKey: 'WMS.TAB_WAVE_RULES',
      module: 'wms',
      list: { path: '/wms/wave-rules', columns: [...cols('name', 'min_priority', 'reference_prefix', 'min_tasks', 'max_tasks', 'priority'), col('is_active', 'bool')], filters: [WAREHOUSE_FILTER] },
      ...CRUD('/wms/wave-rules', act('POST', 'WMS.ACTION_NEW_WAVE_RULE', '/wms/wave-rules', { fields: waveRuleFields(true) })),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/wms/wave-rules/{id}', { prefill: true, fields: waveRuleFields(false) }),
        act('DELETE', 'RES.ACTION.DELETE', '/wms/wave-rules/{id}', { confirm: true, danger: true }),
      ],
    },
  ],
};

function waveRuleFields(create: boolean) {
  return [
    ...(create ? [WAREHOUSE] : []),
    req(rf.text('name', { maxLength: 120 })),
    rf.integer('min_priority', { min: 0, max: 100 }),
    rf.integer('due_within_hours', { min: 0, max: 720 }),
    rf.text('reference_prefix', { maxLength: 60 }),
    rf.integer('min_tasks', { min: 1, max: 1000, defaultValue: 1 }),
    rf.integer('max_tasks', { min: 1, max: 1000, defaultValue: 50 }),
    rf.integer('priority', { min: 0, max: 1000, defaultValue: 100 }),
    ACTIVE,
    rf.textarea('notes', { maxLength: 5000 }),
  ];
}

function slottingRuleFields(create: boolean) {
  return [
    ...(create ? [WAREHOUSE] : []),
    req(rf.text('name', { maxLength: 120 })),
    rf.select('abc_class', ['A', 'B', 'C']),
    rf.decimal('min_velocity', { min: 0 }),
    rf.decimal('max_velocity', { min: 0 }),
    req(rf.select('target_bin_type', WMS_BIN_TYPES)),
    rf.lookup('target_zone_id', 'zones', { dependsOn: 'warehouse_id' }),
    rf.integer('priority', { min: 0, max: 1000, defaultValue: 100 }),
    ACTIVE,
    rf.textarea('notes', { maxLength: 5000 }),
  ];
}

/** Slotting rules and the recommendations computed from the pick velocity. */
export const WMS_SLOTTING_PAGE: ResourcePageConfig = {
  titleKey: 'WMS.PAGE_SLOTTING',
  tabs: [
    {
      id: 'recommendations',
      titleKey: 'WMS.TAB_RECOMMENDATIONS',
      module: 'wms',
      list: { path: '/wms/slotting-recommendations', columns: [col('stock_item.sku'), tagCol('abc_class'), col('velocity', 'decimal'), col('from_bin.code'), col('to_bin.code'), tagCol('status'), col('reason')], filters: [WAREHOUSE_FILTER, rf.select('status', ['pending', 'accepted', 'rejected']), rf.select('abc_class', ['A', 'B', 'C'])] },
      toolbar: [act('POST', 'WMS.ACTION_GENERATE', '/wms/slotting-recommendations/generate', { fields: [WAREHOUSE, rf.integer('period_days', { min: 7, max: 365, defaultValue: 30 })], showResult: true })],
      rowActions: [
        act('POST', 'WMS.ACTION_ACCEPT', '/wms/slotting-recommendations/{id}/accept', { visible: whenIn('status', 'pending') }),
        act('POST', 'WMS.ACTION_REJECT', '/wms/slotting-recommendations/{id}/reject', { confirm: true, danger: true, visible: whenIn('status', 'pending') }),
      ],
    },
    {
      id: 'rules',
      titleKey: 'WMS.TAB_SLOTTING_RULES',
      module: 'wms',
      list: { path: '/wms/slotting-rules', columns: [...cols('name'), tagCol('abc_class'), ...cols('min_velocity', 'max_velocity'), tagCol('target_bin_type'), col('priority'), col('is_active', 'bool')], filters: [WAREHOUSE_FILTER, rf.select('abc_class', ['A', 'B', 'C'])] },
      ...CRUD('/wms/slotting-rules', act('POST', 'WMS.ACTION_NEW_SLOTTING_RULE', '/wms/slotting-rules', { fields: slottingRuleFields(true) })),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/wms/slotting-rules/{id}', { prefill: true, fields: slottingRuleFields(false) }),
        act('DELETE', 'RES.ACTION.DELETE', '/wms/slotting-rules/{id}', { confirm: true, danger: true }),
      ],
    },
  ],
};

const CROSS_DOCK_LINES = rf.lines('lines', [req(rf.lookup('stock_item_id', 'stockItems')), req(rf.decimal('inbound_quantity', { positive: true })), rf.decimal('outbound_quantity', { min: 0 })], { required: true });
const crossDockFields = (create: boolean) => [
  ...(create ? [WAREHOUSE] : []),
  req(rf.text('inbound_reference', { maxLength: 100 })),
  req(rf.text('outbound_reference', { maxLength: 100 })),
  rf.uuid('inbound_door_id'),
  rf.uuid('outbound_door_id'),
  rf.datetime('planned_inbound_at'),
  rf.datetime('planned_outbound_at'),
  rf.textarea('notes', { maxLength: 5000 }),
  CROSS_DOCK_LINES,
];

/** Cross-docking: inbound goods matched to an outbound shipment. */
export const WMS_CROSS_DOCK_PAGE: ResourcePageConfig = {
  titleKey: 'WMS.PAGE_CROSS_DOCK',
  tabs: [
    {
      id: 'cross-dock-orders',
      titleKey: 'WMS.TAB_CROSS_DOCK',
      module: 'wms',
      list: { path: '/wms/cross-dock-orders', columns: [...cols('number', 'inbound_reference', 'outbound_reference'), tagCol('status'), tagCol('match_status'), col('received_at', 'datetime'), col('shipped_at', 'datetime')], filters: [WAREHOUSE_FILTER, rf.select('status', ['planned', 'received', 'shipped', 'cancelled'])] },
      ...CRUD('/wms/cross-dock-orders', act('POST', 'WMS.ACTION_NEW_CROSS_DOCK', '/wms/cross-dock-orders', { fields: crossDockFields(true) })),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/wms/cross-dock-orders/{id}', { prefill: true, fields: crossDockFields(false), visible: whenIn('status', 'planned') }),
        act('POST', 'WMS.ACTION_RECEIVE', '/wms/cross-dock-orders/{id}/receive', { visible: whenIn('status', 'planned') }),
        act('POST', 'WMS.ACTION_ALLOCATE', '/wms/cross-dock-orders/{id}/allocate', { fields: [req(rf.lines('lines', [req(rf.uuid('line_id')), req(rf.decimal('outbound_quantity', { min: 0 }))]))], visible: whenIn('status', 'planned', 'received') }),
        act('POST', 'WMS.ACTION_SHIP', '/wms/cross-dock-orders/{id}/ship', { visible: whenIn('status', 'received') }),
        act('POST', 'WMS.ACTION_CANCEL', '/wms/cross-dock-orders/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'planned', 'received') }),
        act('DELETE', 'RES.ACTION.DELETE', '/wms/cross-dock-orders/{id}', { confirm: true, danger: true, visible: whenIn('status', 'planned', 'cancelled') }),
      ],
    },
  ],
};

const doorFields = (create: boolean) => [...(create ? [WAREHOUSE] : []), req(rf.text('code', { maxLength: 30 })), rf.text('name', { maxLength: 120 }), rf.select('direction', WMS_DOCK_DIRECTIONS, { defaultValue: 'both' }), ACTIVE, rf.textarea('notes', { maxLength: 5000 })];
const appointmentFields = (create: boolean) => [
  ...(create ? [req(rf.uuid('dock_door_id'))] : []),
  req(rf.text('carrier_name', { maxLength: 160 })),
  rf.text('reference', { maxLength: 100 }),
  req(rf.select('direction', ['inbound', 'outbound'])),
  req(rf.datetime('starts_at')),
  req(rf.datetime('ends_at', { notBefore: 'starts_at', strictlyAfter: true })),
  rf.textarea('notes', { maxLength: 5000 }),
];

/** Dock doors and the carrier appointments booked on them. */
export const WMS_DOCKS_PAGE: ResourcePageConfig = {
  titleKey: 'WMS.PAGE_DOCKS',
  tabs: [
    {
      id: 'appointments',
      titleKey: 'WMS.TAB_APPOINTMENTS',
      module: 'wms',
      list: { path: '/wms/dock-appointments', columns: [col('door.code'), ...cols('carrier_name', 'reference'), tagCol('direction'), col('starts_at', 'datetime'), col('ends_at', 'datetime'), tagCol('status')], filters: [WAREHOUSE_FILTER, rf.select('status', ['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show']), rf.date('from'), rf.date('to')] },
      ...CRUD('/wms/dock-appointments', act('POST', 'WMS.ACTION_NEW_APPOINTMENT', '/wms/dock-appointments', { fields: appointmentFields(true) })),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/wms/dock-appointments/{id}', { prefill: true, fields: appointmentFields(false), visible: whenIn('status', 'scheduled') }),
        act('POST', 'WMS.ACTION_CHECK_IN', '/wms/dock-appointments/{id}/check-in', { visible: whenIn('status', 'scheduled') }),
        act('POST', 'WMS.ACTION_COMPLETE', '/wms/dock-appointments/{id}/complete', { visible: whenIn('status', 'checked_in') }),
        act('POST', 'WMS.ACTION_NO_SHOW', '/wms/dock-appointments/{id}/no-show', { confirm: true, visible: whenIn('status', 'scheduled') }),
        act('POST', 'WMS.ACTION_CANCEL', '/wms/dock-appointments/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'scheduled') }),
      ],
    },
    {
      id: 'doors',
      titleKey: 'WMS.TAB_DOORS',
      module: 'wms',
      list: { path: '/wms/dock-doors', columns: [...cols('code', 'name'), tagCol('direction'), col('is_active', 'bool')], filters: [WAREHOUSE_FILTER, rf.select('direction', WMS_DOCK_DIRECTIONS)] },
      ...CRUD('/wms/dock-doors', act('POST', 'WMS.ACTION_NEW_DOOR', '/wms/dock-doors', { fields: doorFields(true) })),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/wms/dock-doors/{id}', { prefill: true, fields: doorFields(false) }),
        act('DELETE', 'RES.ACTION.DELETE', '/wms/dock-doors/{id}', { confirm: true, danger: true }),
      ],
    },
  ],
};
