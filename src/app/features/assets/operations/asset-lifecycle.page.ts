import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const CONDITIONS = ['new', 'excellent', 'good', 'fair', 'poor', 'damaged'] as const;
const LEDGERS = ['statutory', 'tax', 'ifrs', 'management', 'civil', 'fiscal'] as const;

const COMPONENT_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  rf.text('component_code', { maxLength: 60 }),
  rf.uuid('component_asset_id'),
  rf.text('serial_number', { maxLength: 100 }),
  rf.decimal('cost_allocation', { min: 0 }),
  rf.integer('useful_life_months', { min: 1 }),
  rf.select('condition', CONDITIONS),
  rf.date('installed_date'),
];

const ASSIGNMENT_FIELDS = [
  req(rf.select('assignee_type', ['employee', 'department', 'project', 'site', 'vehicle_operator'])),
  rf.uuid('assignee_id'),
  req(rf.text('assignee_name', { maxLength: 150 })),
  rf.uuid('department_id'),
  rf.uuid('project_id'),
  rf.uuid('location_id'),
  rf.datetime('assigned_at'),
  rf.datetime('expected_return_at', { notBefore: 'assigned_at' }),
  rf.textarea('notes', { maxLength: 1000 }),
];

const ALLOCATION_FIELDS = [
  req(rf.uuid('project_id')),
  rf.date('allocated_from'),
  rf.date('allocated_to', { notBefore: 'allocated_from' }),
  rf.decimal('hourly_rate', { min: 0 }),
  rf.decimal('daily_rate', { min: 0 }),
  rf.decimal('utilized_hours', { min: 0 }),
  rf.decimal('utilized_days', { min: 0 }),
  rf.textarea('notes', { maxLength: 1000 }),
];

const ACQUIRE_FIELDS = [
  req(rf.select('source_type', ['passive_invoice_line', 'purchase_order_item'])),
  req(rf.uuid('source_id')),
  req(rf.uuid('category_id')),
  rf.text('name', { maxLength: 190 }),
  rf.uuid('asset_class_id'),
  rf.uuid('location_id'),
  rf.uuid('custodian_user_id'),
  rf.uuid('cost_center_id'),
  rf.text('serial_number', { maxLength: 100 }),
  rf.decimal('salvage_value', { min: 0 }),
  rf.integer('useful_life_years', { min: 1 }),
  rf.date('warranty_expiry_date'),
  rf.bool('capitalize', { defaultValue: true }),
  rf.date('capitalization_date'),
  rf.date('in_service_date'),
  rf.bool('auto_post_to_gl'),
];

/** Lifecycle of the fixed assets: acquisition from a purchase, transfers, valuations, assignments, components and history. */
export const ASSET_LIFECYCLE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.EAM_LIFECYCLE',
  tabs: [
    {
      id: 'assets',
      titleKey: 'RES.P.eam_assets',
      module: 'assets',
      list: {
        path: '/eam/assets',
        columns: [...cols('asset_number', 'name'), tagCol('status'), tagCol('condition'), col('in_service_date', 'date')],
      },
      toolbar: [act('POST', 'RES.A.eam_acquire_asset', '/eam/assets/acquire', { fields: ACQUIRE_FIELDS, showResult: true })],
      rowActions: [
        act('GET', 'RES.A.eam_asset_history', '/eam/assets/{id}/history', { showResult: true }),
        act('GET', 'RES.A.eam_depreciation_preview', '/eam/assets/{id}/depreciation-preview', { showResult: true }),
        act('GET', 'RES.A.eam_maintenance_summary', '/eam/assets/{id}/maintenance-summary', { showResult: true }),
        act('POST', 'RES.A.eam_transfer_asset', '/eam/assets/{id}/transfer', {
          fields: [
            rf.uuid('to_location_id'),
            rf.uuid('to_custodian_id'),
            rf.uuid('to_project_id'),
            rf.uuid('to_cost_center_id'),
            rf.date('transfer_date'),
            rf.textarea('reason', { maxLength: 1000 }),
          ],
        }),
        act('POST', 'RES.A.eam_valuate_asset', '/eam/assets/{id}/valuate', {
          fields: [
            req(rf.select('valuation_type', ['revaluation', 'impairment'])),
            req(rf.decimal('fair_value', { min: 0 })),
            rf.decimal('value_in_use', { min: 0 }),
            rf.date('valuation_date'),
            rf.text('appraiser_name', { maxLength: 150 }),
            rf.textarea('reason', { maxLength: 1000 }),
            rf.bool('auto_post_to_gl'),
          ],
        }),
        act('POST', 'RES.A.eam_reverse_impairment', '/eam/assets/{id}/reverse-impairment', {
          fields: [req(rf.decimal('recoverable_amount', { min: 0 })), rf.textarea('reason', { maxLength: 1000 })],
          confirm: true,
        }),
        act('POST', 'RES.A.eam_assign_custodian', '/eam/assets/{id}/custodians', {
          fields: [req(rf.uuid('custodian_user_id')), rf.text('department', { maxLength: 120 })],
        }),
        act('POST', 'RES.A.eam_assign_asset', '/eam/assets/{id}/assignments', { fields: ASSIGNMENT_FIELDS }),
        act('POST', 'RES.A.eam_allocate_project', '/eam/assets/{id}/project-allocations', { fields: ALLOCATION_FIELDS }),
        act('GET', 'RES.A.eam_asset_components', '/eam/assets/{id}/components', { showResult: true }),
        act('POST', 'RES.A.eam_add_component', '/eam/assets/{id}/components', { fields: COMPONENT_FIELDS }),
        act('POST', 'RES.A.eam_retire_component', '/eam/assets/{id}/components/{component_id}/retire', {
          fields: [req(rf.uuid('component_id')), rf.select('status', ['replaced', 'detached', 'failed'])],
          confirm: true,
        }),
      ],
    },
    {
      id: 'depreciation-runs',
      titleKey: 'RES.P.eam_depreciation_runs',
      module: 'assets',
      list: {
        path: '/eam/depreciation/runs',
        filters: [rf.select('ledger_type', LEDGERS)],
        columns: [
          ...cols('run_number', 'period_code'),
          tagCol('ledger_type'),
          col('assets_processed_count'),
          col('total_depreciation_amount', 'decimal'),
          tagCol('status'),
          col('executed_at', 'datetime'),
        ],
      },
      detailPath: '/eam/depreciation/runs/{id}',
    },
    {
      id: 'maintenance-plans',
      titleKey: 'RES.P.eam_maintenance_plans',
      module: 'assets',
      list: { path: '/eam/maintenance/plans', columns: [...cols('name'), tagCol('status'), col('next_due_date', 'date')] },
      detailPath: '/eam/maintenance/plans/{id}',
    },
    {
      id: 'categories',
      titleKey: 'RES.P.eam_categories',
      module: 'assets',
      list: { path: '/eam/categories', columns: [...cols('code', 'name')] },
      detailPath: '/eam/categories/{id}',
    },
  ],
};
