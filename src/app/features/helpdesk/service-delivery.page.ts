import { act, col, cols, progressCol, ResourcePageConfig, rf, req, tagCol } from '@shared';

const WORK_TYPES = ['corrective', 'preventive', 'inspection', 'installation', 'emergency', 'commissioning'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const BILLING_TYPES = ['contract_included', 'time_and_materials', 'fixed_fee', 'non_billable', 'internal_cost'] as const;

const WORK_ORDER_FIELDS = [
  req(rf.text('title', { maxLength: 255 })),
  rf.textarea('description'),
  rf.select('work_type', WORK_TYPES),
  rf.select('priority', PRIORITIES),
  rf.uuid('service_category_id'),
  rf.lookup('customer_id', 'contacts'),
  rf.uuid('service_contract_id'),
  rf.uuid('asset_id'),
  rf.uuid('ticket_id'),
  rf.uuid('project_id'),
  rf.uuid('service_team_id'),
  rf.uuid('lead_technician_id'),
  rf.datetime('scheduled_start'),
  rf.datetime('scheduled_end'),
  rf.text('location_address', { maxLength: 255 }),
  rf.select('billing_type', BILLING_TYPES),
];

const CONTRACT_STATUSES = ['draft', 'active', 'suspended', 'expired'] as const;
const BILLING_RECURRENCES = ['monthly', 'quarterly', 'yearly'] as const;
const ASSET_STATUSES = ['active', 'under_repair', 'decommissioned'] as const;

const CONTRACT_FIELDS = [
  req(rf.lookup('customer_id', 'contacts')),
  req(rf.text('contract_number', { maxLength: 60 })),
  req(rf.text('title', { maxLength: 180 })),
  req(rf.date('start_date')),
  rf.date('end_date', { notBefore: 'start_date' }),
  rf.select('status', CONTRACT_STATUSES),
  rf.select('billing_recurrence', BILLING_RECURRENCES),
  rf.decimal('annual_value', { min: 0 }),
  rf.decimal('sla_response_hours', { min: 0 }),
  rf.decimal('included_hours', { min: 0 }),
  rf.integer('low_balance_threshold_percent', { min: 0, max: 100 }),
  rf.text('report_email', { maxLength: 255 }),
  rf.tags('asset_ids'),
];

/** Top-up (positive hours) or signed adjustment of a contract hour bank; every entry lands in the ledger. */
const HOUR_FIELDS = [req(rf.decimal('hours')), rf.text('description', { maxLength: 255 })];

/** Service work orders of the ESM module with the dispatch, visit, parts and invoicing steps. */
export const SERVICE_WORK_ORDERS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SERVICE_DELIVERY',
  tabs: [
    {
      id: 'work-orders',
      titleKey: 'RES.P.service_work_orders',
      module: 'service',
      list: {
        path: '/esm/work-orders',
        filters: [rf.text('status'), rf.select('work_type', WORK_TYPES)],
        columns: [
          ...cols('work_order_number', 'title'),
          tagCol('work_type'),
          tagCol('priority'),
          tagCol('status'),
          col('scheduled_start', 'datetime'),
          col('total_billed_amount', 'decimal'),
        ],
      },
      detailPath: '/esm/work-orders/{id}',
      create: act('POST', 'RES.A.new_work_order', '/esm/work-orders', { fields: WORK_ORDER_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.dispatch', '/esm/work-orders/{id}/dispatch', { fields: [rf.uuid('technician_id')] }),
        act('POST', 'RES.A.schedule', '/esm/work-orders/{id}/schedule', {
          fields: [
            req(rf.uuid('technician_id')),
            req(rf.datetime('scheduled_start')),
            req(rf.datetime('scheduled_end', { notBefore: 'scheduled_start', strictlyAfter: true })),
            rf.textarea('notes'),
          ],
        }),
        act('POST', 'RES.A.record_visit', '/esm/work-orders/{id}/record-visit', {
          fields: [
            rf.uuid('technician_id'),
            rf.uuid('service_appointment_id'),
            rf.datetime('check_in_at'),
            rf.datetime('check_out_at'),
            rf.textarea('work_summary'),
            rf.textarea('customer_feedback'),
          ],
        }),
        act('POST', 'RES.A.issue_part', '/esm/work-orders/{id}/parts', {
          fields: [
            req(rf.text('item_number', { maxLength: 100 })),
            req(rf.decimal('quantity')),
            rf.decimal('unit_cost'),
            rf.decimal('unit_price'),
            rf.text('description', { maxLength: 255 }),
            rf.uuid('warehouse_id'),
          ],
        }),
        act('POST', 'RES.A.complete_work_order', '/esm/work-orders/{id}/complete', {
          fields: [
            rf.textarea('completion_notes', { maxLength: 5000 }),
            rf.textarea('resolution_summary', { maxLength: 5000 }),
            rf.text('signed_by_customer_name', { maxLength: 150 }),
            rf.datetime('signed_at'),
          ],
        }),
        act('POST', 'RES.A.invoice_work_order', '/esm/work-orders/{id}/invoice', {
          fields: [req(rf.decimal('tax_rate')), rf.date('due_date'), rf.uuid('revenue_account_id')],
          showResult: true,
          visible: (row) => !row['is_invoiced'],
        }),
      ],
    },
    {
      id: 'service-contracts',
      titleKey: 'RES.P.service_contracts',
      module: 'service',
      list: {
        path: '/esm/service-contracts',
        filters: [rf.select('status', CONTRACT_STATUSES)],
        columns: [
          ...cols('contract_number', 'name'),
          tagCol('status'),
          tagCol('billing_recurrence'),
          col('start_date', 'date'),
          col('end_date', 'date'),
          col('included_hours', 'decimal'),
          col('remaining_hours', 'decimal'),
          progressCol('consumed_hours', 'included_hours', 'RES.F.hour_usage'),
          col('low_balance', 'bool'),
        ],
      },
      detailPath: '/esm/service-contracts/{id}',
      create: act('POST', 'RES.A.new_maintenance_contract', '/esm/service-contracts', { fields: CONTRACT_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/esm/service-contracts/{id}', {
          prefill: true,
          fields: CONTRACT_FIELDS.filter((field) => field.key !== 'included_hours'),
        }),
        act('POST', 'RES.A.top_up_hours', '/esm/service-contracts/{id}/hours/top-up', { fields: HOUR_FIELDS }),
        act('POST', 'RES.A.adjust_hours', '/esm/service-contracts/{id}/hours/adjust', { fields: HOUR_FIELDS }),
        act('GET', 'RES.A.hour_ledger', '/esm/service-contracts/{id}/ledger', { showResult: true }),
        act('POST', 'RES.A.send_residual_report', '/esm/service-contracts/{id}/residual-report', { confirm: true }),
      ],
    },
    {
      id: 'installed-base',
      titleKey: 'RES.P.installed_base',
      module: 'service',
      list: {
        path: '/esm/equipment-passports',
        filters: [rf.text('serial_number'), rf.select('asset_status', ASSET_STATUSES), rf.select('warranty', ['in', 'out'])],
        columns: [
          ...cols('serial_number', 'installation_site'),
          tagCol('asset_status'),
          tagCol('warranty_status'),
          col('commissioning_date', 'date'),
          col('warranty_expiry_date', 'date'),
        ],
      },
      detailPath: '/esm/equipment-passports/{id}',
      rowActions: [
        act('GET', 'RES.A.asset_history', '/esm/equipment-passports/{id}/history', { showResult: true }),
        act('PUT', 'RES.ACTION.EDIT', '/esm/equipment-passports/{id}', {
          prefill: true,
          fields: [
            rf.select('asset_status', ASSET_STATUSES),
            rf.date('commissioning_date'),
            rf.text('installation_site', { maxLength: 255 }),
          ],
        }),
      ],
    },
  ],
};
