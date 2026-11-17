import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol } from '@shared';

const COST_CATEGORIES = ['labour', 'material', 'supplier', 'fleet', 'expense', 'equipment'] as const;
const DEPENDENCY_TYPES = ['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'] as const;

const COST_FIELDS = [
  req(rf.select('cost_category', COST_CATEGORIES)),
  req(rf.text('cost_source_type', { maxLength: 100 })),
  req(rf.uuid('cost_source_id')),
  rf.text('description'),
  req(rf.decimal('quantity', { positive: true })),
  req(rf.decimal('unit_cost', { min: 0 })),
  rf.decimal('total_cost', { min: 0 }),
  req(rf.date('incurred_date')),
  rf.uuid('phase_id'),
  rf.uuid('task_id'),
  rf.text('uom'),
  rf.bool('is_billable'),
];

/**
 * Per-project panels (the project id fills `{project_id}` through the panel context): billing events, forecast,
 * EVM snapshots, audit trail, critical path with task dependencies and assignments, direct cost entries.
 */
export const PROJECT_TOOL_PANELS: readonly ResourcePanelConfig[] = [
  {
    id: 'billing-events',
    titleKey: 'RES.P.billing_events',
    module: 'projects',
    list: {
      path: '/projects/{project_id}/billing-events',
      columns: [...cols('type', 'description'), col('amount', 'decimal'), col('created_at', 'datetime')],
    },
  },
  {
    id: 'forecast',
    titleKey: 'RES.P.project_forecast',
    module: 'projects',
    list: { path: '/projects/{project_id}/forecast', columns: [], report: true },
  },
  {
    id: 'evm-snapshots',
    titleKey: 'RES.P.evm_snapshots',
    module: 'projects',
    list: { path: '/projects/{project_id}/evm-snapshots', columns: [col('snapshot_date', 'date'), ...cols('pv', 'ev', 'ac', 'cpi', 'spi')] },
  },
  {
    id: 'audit-trail',
    titleKey: 'RES.P.audit_trail',
    module: 'projects',
    list: { path: '/projects/{project_id}/audit-trail', columns: [...cols('action', 'entity_type', 'user_id'), col('created_at', 'datetime')] },
  },
  {
    id: 'costs-direct',
    titleKey: 'RES.P.direct_costs',
    module: 'projects',
    list: {
      path: '/projects/{project_id}/costs',
      columns: [tagCol('cost_category'), ...cols('description'), col('quantity', 'decimal'), col('total_cost', 'decimal'), col('incurred_date', 'date')],
    },
    create: act('POST', 'RES.A.new_cost', '/projects/{project_id}/costs', { fields: COST_FIELDS }),
  },
  {
    id: 'critical-path',
    titleKey: 'RES.P.critical_path',
    module: 'projects',
    list: { path: '/projects/{project_id}/critical-path', columns: [], report: true },
    toolbar: [
      act('POST', 'RES.A.add_dependency', '/projects/tasks/{task_id}/dependencies', {
        fields: [
          req(rf.uuid('task_id')),
          req(rf.uuid('predecessor_task_id', { differentFrom: 'task_id' })),
          rf.select('dependency_type', DEPENDENCY_TYPES),
          rf.integer('lag_days'),
        ],
      }),
      act('DELETE', 'RES.A.remove_dependency', '/projects/task-dependencies/{dependency_id}', {
        fields: [req(rf.uuid('dependency_id'))],
        confirm: true,
      }),
      act('POST', 'RES.A.assign_task', '/projects/tasks/{task_id}/assignments', {
        fields: [req(rf.uuid('task_id')), req(rf.uuid('user_id')), req(rf.decimal('allocated_hours', { positive: true })), rf.text('role_description')],
      }),
      act('DELETE', 'RES.A.remove_assignment', '/projects/task-assignments/{assignment_id}', {
        fields: [req(rf.uuid('assignment_id'))],
        confirm: true,
      }),
    ],
  },
];

/** Company-wide planning: rate cards and resource capacity. */
export const PROJECT_PLANNING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PROJECT_PLANNING',
  tabs: [
    {
      id: 'rate-cards',
      titleKey: 'RES.P.rate_cards',
      module: 'projects',
      list: {
        path: '/projects/rate-cards',
        columns: [
          ...cols('project_id', 'user_id', 'role'),
          col('cost_rate', 'decimal'),
          col('bill_rate', 'decimal'),
          col('valid_from', 'date'),
          col('valid_to', 'date'),
        ],
      },
      create: act('POST', 'RES.A.new_rate_card', '/projects/rate-cards', {
        fields: [
          rf.uuid('project_id'),
          rf.uuid('user_id'),
          rf.text('role'),
          req(rf.decimal('cost_rate', { min: 0 })),
          req(rf.decimal('bill_rate', { min: 0 })),
          rf.date('valid_from'),
          rf.date('valid_to', { notBefore: 'valid_from' }),
        ],
      }),
      rowActions: [act('DELETE', 'RES.ACTION.DELETE', '/projects/rate-cards/{id}', { confirm: true, danger: true })],
    },
    {
      id: 'resource-capacity',
      titleKey: 'RES.P.resource_capacity',
      module: 'projects',
      list: {
        path: '/projects/resource-capacity',
        columns: [],
        filters: [req(rf.date('from')), req(rf.date('to', { notBefore: 'from' })), rf.uuid('user_id')],
        report: true,
        manual: true,
      },
    },
  ],
};
