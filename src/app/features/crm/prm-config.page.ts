import {
  CRM_APPROVER_ROLES,
  CRM_AUTOMATION_EXIT_CONDITIONS,
  CRM_AUTOMATION_TRIGGERS,
  CRM_PARTNER_STATUSES,
  CRM_PARTNER_TYPES,
  CRM_PRICING_RULE_TYPES,
} from '@core';
import { act, col, cols, ResourceField, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const QUOTA_FIELDS = [
  req(rf.uuid('user_id')),
  rf.uuid('territory_id'),
  req(rf.date('period_start')),
  req(rf.date('period_end', { notBefore: 'period_start' })),
  req(rf.decimal('target_amount', { min: 0 })),
  rf.text('currency', { maxLength: 3 }),
  rf.textarea('notes', { maxLength: 1000 }),
];

const TIER_FIELDS = [
  req(rf.text('code', { maxLength: 30 })),
  req(rf.text('name', { maxLength: 100 })),
  req(rf.integer('rank', { min: 0 })),
  req(rf.decimal('min_annual_revenue', { min: 0 })),
  req(rf.decimal('discount_percent', { min: 0, max: 100 })),
  req(rf.decimal('mdf_percent', { min: 0, max: 100 })),
];

const PARTNER_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  rf.uuid('account_id'),
  req(rf.select('partner_type', CRM_PARTNER_TYPES)),
  req(rf.select('status', CRM_PARTNER_STATUSES)),
  rf.text('contact_email', { maxLength: 190 }),
  rf.date('joined_on'),
];

const DEAL_FIELDS = [
  req(rf.uuid('partner_id')),
  req(rf.text('customer_name', { maxLength: 190 })),
  rf.uuid('opportunity_id'),
  rf.decimal('expected_amount', { min: 0 }),
  rf.text('currency', { maxLength: 3 }),
  rf.date('registered_on'),
  rf.date('expires_on', { notBefore: 'registered_on' }),
];

const FUND_FIELDS = [
  req(rf.uuid('partner_id')),
  req(rf.integer('fiscal_year', { min: 2000, max: 2100 })),
  rf.decimal('allocated_amount', { min: 0 }),
  rf.text('currency', { maxLength: 3 }),
];

const CLAIM_FIELDS = [
  req(rf.text('activity', { maxLength: 190 })),
  req(rf.decimal('amount', { min: 0 })),
  rf.date('activity_date'),
];

const PRICING_RULE_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  req(rf.select('rule_type', CRM_PRICING_RULE_TYPES)),
  req(rf.decimal('min_quantity', { min: 0 })),
  rf.text('partner_tier_code', { maxLength: 30 }),
  req(rf.decimal('discount_percent', { min: 0, max: 100 })),
  rf.integer('priority', { min: 0 }),
  rf.date('valid_from'),
  rf.date('valid_to', { notBefore: 'valid_from' }),
  rf.bool('is_active', { defaultValue: true }),
];

const THRESHOLD_FIELDS = [
  req(rf.decimal('from_discount_percent', { min: 0, max: 100 })),
  req(rf.select('approver_role', CRM_APPROVER_ROLES)),
];

const QUOTE_FIELDS = [
  req(rf.text('name', { maxLength: 190 })),
  rf.uuid('opportunity_id'),
  rf.uuid('product_configuration_id'),
  rf.uuid('partner_id'),
  rf.decimal('quantity', { min: 0 }),
  rf.decimal('unit_price', { min: 0 }),
  rf.text('currency', { maxLength: 3 }),
  rf.decimal('extra_discount_percent', { min: 0, max: 100 }),
];

const SEQUENCE_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  req(rf.select('entity', ['contacts', 'leads'])),
  req(rf.select('trigger_type', CRM_AUTOMATION_TRIGGERS)),
  rf.uuid('segment_id'),
  rf.multiselect('exit_conditions', CRM_AUTOMATION_EXIT_CONDITIONS),
  rf.bool('is_active', { defaultValue: true }),
];

const edit = (path: string, fields: readonly ResourceField[]) =>
  act('PUT', 'RES.ACTION.EDIT', path, { prefill: true, fields });

const remove = (path: string) => act('DELETE', 'RES.ACTION.DELETE', path, { confirm: true, danger: true });

/** Partner programme, CPQ and sales-planning master data: create, edit and delete records the overview pages only read. */
export const CRM_PRM_CONFIG_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CRM_PRM_CONFIG',
  tabs: [
    {
      id: 'sales-quotas',
      titleKey: 'RES.P.crm_sales_quotas',
      module: 'crm',
      list: {
        path: '/crm/sales-quotas',
        columns: [col('user_id'), col('period_start', 'date'), col('period_end', 'date'), col('target_amount', 'decimal'), col('currency')],
      },
      detailPath: '/crm/sales-quotas/{id}',
      create: act('POST', 'RES.A.crm_new_sales_quota', '/crm/sales-quotas', { fields: QUOTA_FIELDS }),
      rowActions: [edit('/crm/sales-quotas/{id}', QUOTA_FIELDS), remove('/crm/sales-quotas/{id}')],
    },
    {
      id: 'partner-tiers',
      titleKey: 'RES.P.crm_partner_tiers',
      module: 'crm',
      list: {
        path: '/crm/partner-tiers',
        columns: [...cols('code', 'name', 'rank'), col('min_annual_revenue', 'decimal'), col('discount_percent', 'decimal'), col('mdf_percent', 'decimal')],
      },
      detailPath: '/crm/partner-tiers/{id}',
      create: act('POST', 'RES.A.crm_new_partner_tier', '/crm/partner-tiers', { fields: TIER_FIELDS }),
      rowActions: [edit('/crm/partner-tiers/{id}', TIER_FIELDS), remove('/crm/partner-tiers/{id}')],
    },
    {
      id: 'partners',
      titleKey: 'RES.P.crm_partners',
      module: 'crm',
      list: {
        path: '/crm/partners',
        columns: [...cols('name'), tagCol('partner_type'), tagCol('status'), col('closed_revenue', 'decimal'), col('joined_on', 'date')],
      },
      detailPath: '/crm/partners/{id}',
      rowActions: [
        edit('/crm/partners/{id}', PARTNER_FIELDS),
        act('POST', 'RES.A.crm_evaluate_partner_tier', '/crm/partners/{id}/evaluate-tier', { confirm: true, showResult: true }),
        remove('/crm/partners/{id}'),
      ],
    },
    {
      id: 'deal-registrations',
      titleKey: 'RES.P.crm_deal_registrations',
      module: 'crm',
      list: {
        path: '/crm/deal-registrations',
        columns: [...cols('customer_name'), col('expected_amount', 'decimal'), tagCol('status'), col('registered_on', 'date'), col('expires_on', 'date')],
      },
      detailPath: '/crm/deal-registrations/{id}',
      create: act('POST', 'RES.A.crm_new_deal_registration', '/crm/deal-registrations', { fields: DEAL_FIELDS }),
      toolbar: [act('POST', 'RES.A.crm_expire_deal_registrations', '/crm/deal-registrations/expire', { confirm: true, showResult: true })],
    },
    {
      id: 'mdf-funds',
      titleKey: 'RES.P.crm_mdf_funds',
      module: 'crm',
      list: {
        path: '/crm/mdf-funds',
        columns: [...cols('partner_id', 'fiscal_year'), col('allocated_amount', 'decimal'), col('currency')],
      },
      detailPath: '/crm/mdf-funds/{id}',
      create: act('POST', 'RES.A.crm_new_mdf_fund', '/crm/mdf-funds', { fields: FUND_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.crm_submit_mdf_claim', '/crm/mdf-funds/{id}/claims', { fields: CLAIM_FIELDS }),
        act('GET', 'RES.A.crm_mdf_fund_claims', '/crm/mdf-funds/{id}/claims', { showResult: true }),
        remove('/crm/mdf-funds/{id}'),
      ],
    },
    {
      id: 'pricing-rules',
      titleKey: 'RES.P.crm_pricing_rules',
      module: 'crm',
      list: {
        path: '/crm/pricing-rules',
        columns: [...cols('name'), tagCol('rule_type'), col('min_quantity', 'decimal'), col('discount_percent', 'decimal'), col('is_active', 'bool')],
      },
      detailPath: '/crm/pricing-rules/{id}',
      create: act('POST', 'RES.A.crm_new_pricing_rule', '/crm/pricing-rules', { fields: PRICING_RULE_FIELDS }),
      rowActions: [edit('/crm/pricing-rules/{id}', PRICING_RULE_FIELDS), remove('/crm/pricing-rules/{id}')],
    },
    {
      id: 'discount-thresholds',
      titleKey: 'RES.P.crm_discount_thresholds',
      module: 'crm',
      list: {
        path: '/crm/discount-thresholds',
        columns: [col('from_discount_percent', 'decimal'), tagCol('approver_role')],
      },
      detailPath: '/crm/discount-thresholds/{id}',
      create: act('POST', 'RES.A.crm_new_discount_threshold', '/crm/discount-thresholds', { fields: THRESHOLD_FIELDS }),
      rowActions: [edit('/crm/discount-thresholds/{id}', THRESHOLD_FIELDS), remove('/crm/discount-thresholds/{id}')],
    },
    {
      id: 'quote-configurations',
      titleKey: 'RES.P.crm_quote_configurations',
      module: 'crm',
      list: {
        path: '/crm/quote-configurations',
        columns: [...cols('name'), col('quantity', 'decimal'), col('discount_percent', 'decimal'), col('net_total', 'decimal'), tagCol('status')],
      },
      detailPath: '/crm/quote-configurations/{id}',
      create: act('POST', 'RES.A.crm_new_quote_configuration', '/crm/quote-configurations', { fields: QUOTE_FIELDS }),
      rowActions: [
        { ...edit('/crm/quote-configurations/{id}', QUOTE_FIELDS), visible: whenIn('status', 'draft', 'rejected') },
        { ...remove('/crm/quote-configurations/{id}'), visible: whenIn('status', 'draft', 'rejected') },
      ],
    },
    {
      id: 'automation-sequences',
      titleKey: 'RES.P.crm_automation_sequences',
      module: 'crm',
      list: {
        path: '/crm/automation-sequences',
        columns: [...cols('name'), tagCol('entity'), tagCol('trigger_type'), col('is_active', 'bool')],
      },
      detailPath: '/crm/automation-sequences/{id}',
      rowActions: [
        edit('/crm/automation-sequences/{id}', SEQUENCE_FIELDS),
        act('POST', 'RES.A.crm_enroll_automation', '/crm/automation-sequences/{id}/enroll', {
          fields: [rf.uuid('contact_id'), rf.uuid('lead_id')],
        }),
      ],
    },
  ],
};
