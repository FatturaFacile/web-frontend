import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const BILLING_INTERVALS = ['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;
const PRICING_MODELS = ['flat', 'per_unit', 'tiered', 'volume', 'stairstep'] as const;

const PLAN_FIELDS = [
  req(rf.text('plan_code', { maxLength: 50 })),
  req(rf.text('name', { maxLength: 150 })),
  rf.textarea('description', { maxLength: 5000 }),
  req(rf.select('billing_interval', BILLING_INTERVALS)),
  rf.integer('interval_count', { min: 1, max: 12 }),
  rf.select('billing_alignment', ['anniversary', 'calendar']),
  rf.select('pricing_model', PRICING_MODELS),
  rf.text('currency', { maxLength: 3, defaultValue: 'EUR' }),
  rf.decimal('setup_fee', { min: 0 }),
  req(rf.decimal('base_price', { min: 0 })),
  rf.decimal('tax_rate', { min: 0, max: 100 }),
  rf.integer('trial_period_days', { min: 0, max: 730 }),
  rf.integer('min_commitment_cycles', { min: 1, max: 120 }),
  rf.decimal('renewal_price_increase_percent', { min: 0, max: 100 }),
  rf.uuid('revenue_account_id'),
  rf.uuid('deferred_revenue_account_id'),
  rf.lines('tiers', [
    req(rf.decimal('from_quantity', { min: 0 })),
    rf.decimal('to_quantity', { min: 0 }),
    req(rf.decimal('unit_price', { min: 0 })),
    rf.decimal('flat_fee', { min: 0 }),
  ]),
];

const DUNNING_FIELDS = [
  req(rf.text('policy_name', { maxLength: 100 })),
  req(rf.integer('soft_reminder_days', { min: 0, max: 365 })),
  req(rf.integer('formal_notice_days', { min: 0, max: 365, atLeastField: 'soft_reminder_days' })),
  req(rf.integer('suspension_days', { min: 0, max: 730, atLeastField: 'formal_notice_days' })),
  req(rf.integer('termination_days', { min: 0, max: 1095, atLeastField: 'suspension_days' })),
  rf.integer('max_collection_retries', { min: 0, max: 10 }),
  rf.integer('retry_interval_days', { min: 1, max: 30 }),
];

/** Plan catalogue, dunning policy, contract invoices and revenue contracts of the subscription engine. */
export const SUBSCRIPTIONS_CATALOG_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.SUBSCRIPTIONS_CATALOG',
  tabs: [
    {
      id: 'plans',
      titleKey: 'RES.P.subscription_plans',
      module: 'subscriptions',
      detailPath: '/subscriptions/plans/{id}',
      list: {
        path: '/subscriptions/plans',
        columns: [...cols('plan_code', 'name', 'billing_interval'), col('base_price', 'decimal'), ...cols('currency'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_plan', '/subscriptions/plans', { fields: PLAN_FIELDS }),
    },
    {
      id: 'dunning-policy',
      titleKey: 'RES.P.dunning_policy',
      module: 'subscriptions',
      list: { path: '/subscriptions/dunning-policy', columns: [], report: true },
      toolbar: [act('PUT', 'RES.A.edit_dunning_policy', '/subscriptions/dunning-policy', { fields: DUNNING_FIELDS })],
    },
    {
      id: 'contract-invoices',
      titleKey: 'RES.P.contract_invoices',
      module: 'subscriptions',
      detailPath: '/sub/contracts/{id}',
      list: {
        path: '/sub/contracts',
        columns: [...cols('contract_number', 'customer_id', 'plan_id'), tagCol('status'), col('next_billing_date', 'date')],
      },
      rowActions: [act('GET', 'RES.A.contract_invoices', '/sub/contracts/{id}/invoices', { showResult: true })],
    },
    {
      id: 'revenue-contracts',
      titleKey: 'RES.P.revenue_contracts',
      module: 'subscriptions',
      detailPath: '/subscriptions/revenue-contracts/{id}',
      list: { path: '/subscriptions/revenue-contracts', columns: [...cols('contract_number', 'status'), col('total_amount', 'decimal'), ...cols('currency')] },
    },
  ],
};
