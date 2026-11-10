import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const WORK_TYPES = ['corrective', 'preventive', 'inspection', 'installation', 'emergency', 'commissioning'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const BILLING_TYPES = ['contract_included', 'time_and_materials', 'fixed_fee', 'non_billable', 'internal_cost'] as const;

const WORK_ORDER_FIELDS = [
  req(rf.text('title')),
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
  rf.text('location_address'),
  rf.select('billing_type', BILLING_TYPES),
];

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
            req(rf.datetime('scheduled_end')),
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
            req(rf.text('item_number')),
            req(rf.decimal('quantity')),
            rf.decimal('unit_cost'),
            rf.decimal('unit_price'),
            rf.text('description'),
            rf.uuid('warehouse_id'),
          ],
        }),
        act('POST', 'RES.A.complete_work_order', '/esm/work-orders/{id}/complete', {
          fields: [
            rf.textarea('completion_notes'),
            rf.textarea('resolution_summary'),
            rf.text('signed_by_customer_name'),
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
        filters: [rf.text('status')],
        columns: [
          ...cols('contract_number', 'name'),
          tagCol('contract_type'),
          tagCol('status'),
          col('start_date', 'date'),
          col('end_date', 'date'),
          col('contract_value', 'decimal'),
          ...cols('currency'),
        ],
      },
      detailPath: '/esm/service-contracts/{id}',
    },
  ],
};
