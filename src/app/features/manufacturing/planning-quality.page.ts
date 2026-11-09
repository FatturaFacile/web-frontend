import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const PLAN_FIELDS = [
  req(rf.text('plan_code')),
  req(rf.text('name')),
  req(rf.select('inspection_type', ['receipt', 'in_process', 'final'])),
  rf.lookup('mfg_item_id', 'mfgItems'),
  rf.textarea('description'),
  rf.integer('acceptance_defect_limit', { min: 0 }),
  rf.bool('is_active', { defaultValue: true }),
  rf.json('characteristics', { defaultValue: '[]' }),
];

const INSPECTION_FIELDS = [
  req(rf.uuid('quality_plan_id')),
  req(rf.select('inspection_point', ['receipt', 'operation', 'final'])),
  rf.uuid('production_order_id'),
  rf.uuid('production_order_operation_id'),
  rf.uuid('material_movement_id'),
  rf.integer('sample_size', { min: 0 }),
  rf.integer('defect_count', { min: 0 }),
  rf.decimal('quantity_inspected'),
  rf.decimal('quantity_rejected'),
  rf.textarea('notes'),
  rf.json('characteristic_results', { defaultValue: '[]' }),
];

const NC_FIELDS = [
  rf.uuid('production_order_id'),
  rf.lookup('mfg_item_id', 'mfgItems'),
  req(rf.select('severity', ['minor', 'major', 'critical'])),
  req(rf.text('defect_type')),
  req(rf.textarea('description')),
  rf.decimal('quantity'),
];

const WINDOW_FILTERS = [req(rf.datetime('from')), req(rf.datetime('to')), rf.uuid('work_center_id')];

const ACCOUNT_FIELDS = [
  rf.text('raw_material_account_code'),
  rf.text('wip_account_code'),
  rf.text('finished_goods_account_code'),
  rf.text('labor_absorbed_account_code'),
  rf.text('overhead_absorbed_account_code'),
  rf.text('subcontract_accrual_account_code'),
  rf.text('material_variance_account_code'),
  rf.text('labor_variance_account_code'),
  rf.text('overhead_variance_account_code'),
  rf.text('subcontract_variance_account_code'),
];

/** Quality plans, inspections and non-conformances. */
export const MFG_QUALITY_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.MFG_QUALITY',
  tabs: [
    {
      id: 'quality-plans',
      titleKey: 'RES.P.quality_plans',
      module: 'manufacturing',
      list: {
        path: '/manufacturing/quality/plans',
        columns: [...cols('plan_code', 'name'), tagCol('inspection_type'), col('acceptance_defect_limit'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_quality_plan', '/manufacturing/quality/plans', { fields: PLAN_FIELDS }),
    },
    {
      id: 'quality-inspections',
      titleKey: 'RES.P.inspections',
      module: 'manufacturing',
      list: {
        path: '/manufacturing/quality/inspections',
        columns: [...cols('inspection_number', 'quality_plan_id'), tagCol('inspection_point'), tagCol('status'), ...cols('quantity_inspected', 'quantity_accepted', 'quantity_rejected'), col('inspected_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_inspection', '/manufacturing/quality/inspections', { fields: INSPECTION_FIELDS, showResult: true }),
    },
    {
      id: 'non-conformances',
      titleKey: 'RES.P.non_conformances',
      module: 'manufacturing',
      list: {
        path: '/manufacturing/quality/non-conformances',
        columns: [...cols('nc_number', 'defect_type'), tagCol('severity'), tagCol('status'), tagCol('disposition'), col('quantity'), col('created_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_non_conformance', '/manufacturing/quality/non-conformances', { fields: NC_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.resolve', '/manufacturing/quality/non-conformances/{id}/resolve', {
          fields: [req(rf.select('disposition', ['use_as_is', 'rework', 'scrap', 'return_to_supplier'])), req(rf.textarea('corrective_action'))],
          visible: whenIn('status', 'open'),
        }),
      ],
    },
  ],
};

/** MRP runs, planned orders, shortages, forecasts, KPIs and accounting settings. */
export const MFG_PLANNING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.MFG_PLANNING',
  tabs: [
    {
      id: 'mrp-runs',
      titleKey: 'RES.P.mrp_runs',
      module: 'manufacturing',
      detailPath: '/manufacturing/mrp/runs/{id}',
      list: {
        path: '/manufacturing/mrp/runs',
        columns: [...cols('run_number'), tagCol('run_type'), tagCol('status'), col('horizon_start_date', 'date'), col('horizon_end_date', 'date'), ...cols('total_planned_orders', 'total_shortages')],
      },
      create: act('POST', 'RES.A.run_mrp', '/manufacturing/mrp/runs', {
        fields: [req(rf.datetime('horizon_start_date')), req(rf.datetime('horizon_end_date')), rf.select('run_type', ['regenerative', 'net_change'])],
        showResult: true,
      }),
    },
    {
      id: 'planned-orders',
      titleKey: 'RES.P.planned_orders',
      module: 'manufacturing',
      list: {
        path: '/manufacturing/mrp/planned-orders',
        columns: [...cols('planned_order_number', 'mfg_item_id'), tagCol('order_type'), ...cols('quantity', 'net_requirement'), col('start_date', 'date'), col('due_date', 'date'), tagCol('status')],
      },
      rowActions: [
        act('POST', 'RES.A.convert_to_production', '/manufacturing/mrp/planned-orders/{id}/convert', {
          confirm: true,
          showResult: true,
          visible: (row) => row['order_type'] === 'make' && row['status'] !== 'converted',
        }),
        act('POST', 'RES.A.link_procurement', '/manufacturing/mrp/planned-orders/{id}/procurement-link', {
          fields: [req(rf.select('procurement_document_type', ['purchase_requisition', 'purchase_order'])), req(rf.uuid('procurement_document_id'))],
          visible: (row) => row['order_type'] === 'buy',
        }),
      ],
    },
    {
      id: 'mrp-shortages',
      titleKey: 'RES.P.shortages',
      module: 'manufacturing',
      list: {
        path: '/manufacturing/mrp/shortages',
        columns: [...cols('mfg_item_id'), col('required_date', 'date'), ...cols('gross_requirement', 'available_inventory', 'scheduled_receipts', 'net_shortage'), tagCol('recommended_action')],
      },
    },
    {
      id: 'mrp-purchase-suggestions',
      titleKey: 'RES.P.mrp_purchase_suggestions',
      module: 'manufacturing',
      list: {
        path: '/manufacturing/mrp/purchase-suggestions',
        columns: [...cols('planned_order_number', 'mfg_item_id', 'quantity'), col('due_date', 'date'), tagCol('status'), tagCol('procurement_document_type')],
      },
    },
    {
      id: 'forecasts',
      titleKey: 'RES.P.forecasts',
      module: 'manufacturing',
      list: { path: '/manufacturing/mrp/forecasts', columns: [...cols('mfg_item_id', 'quantity', 'notes'), col('forecast_date', 'date')] },
      create: act('POST', 'RES.A.new_forecast', '/manufacturing/mrp/forecasts', {
        fields: [req(rf.lookup('mfg_item_id', 'mfgItems')), req(rf.datetime('forecast_date')), req(rf.decimal('quantity')), rf.textarea('notes')],
      }),
      rowActions: [act('DELETE', 'RES.ACTION.DELETE', '/manufacturing/mrp/forecasts/{id}', { confirm: true, danger: true })],
    },
    {
      id: 'kpis',
      titleKey: 'RES.P.mfg_kpis',
      module: 'manufacturing',
      list: { path: '/manufacturing/kpis', report: true, manual: true, filters: WINDOW_FILTERS, columns: [] },
    },
    {
      id: 'accounting-settings',
      titleKey: 'RES.P.mfg_accounting',
      module: 'manufacturing',
      list: { path: '/manufacturing/settings/accounting', report: true, columns: [] },
      toolbar: [act('PUT', 'RES.A.edit_accounts', '/manufacturing/settings/accounting', { prefill: true, fields: ACCOUNT_FIELDS })],
    },
  ],
};
