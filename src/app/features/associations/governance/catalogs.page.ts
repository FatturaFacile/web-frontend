import { col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';
import { catalogTab } from './catalog-tab';

const REGISTRY_KINDS = ['member', 'cardholder', 'candidate', 'volunteer', 'sponsor', 'instructor', 'donor', 'supplier_link', 'custom'] as const;
const YEAR_KINDS = ['associative', 'sport'] as const;
const FEE_FREQUENCIES = ['one_off', 'monthly', 'bimonthly', 'quarterly', 'four_monthly', 'half_yearly', 'annual', 'per_attendance'] as const;
const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const;
const CERTIFICATE_KINDS = ['non_competitive', 'competitive'] as const;
const CAMPAIGN_KINDS = ['regular', 'occasional'] as const;
const ACTIVITY_KINDS = ['general_interest', 'secondary'] as const;

const CODE = req(rf.text('code', { maxLength: 50 }));
const NAME = req(rf.text('name', { maxLength: 255 }));
const ACTIVE = rf.bool('is_active', { defaultValue: true });
const SORT_ORDER = rf.integer('sort_order', { min: 0 });

/** Catalogs that configure the registry, the fees, the places and the legal parameters of the association. */
export const ASSOCIATIONS_CATALOGS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_CATALOGS',
  tabs: [
    catalogTab(
      'years',
      [...cols('code', 'name'), tagCol('kind'), col('starts_on', 'date'), col('ends_on', 'date'), tagCol('status')],
      [
        req(rf.text('code', { maxLength: 30 })),
        NAME,
        rf.select('kind', YEAR_KINDS),
        req(rf.date('starts_on')),
        req(rf.date('ends_on', { notBefore: 'starts_on' })),
        rf.select('status', ['open', 'closed']),
      ],
    ),
    catalogTab(
      'registry-types',
      [...cols('code', 'name'), tagCol('kind'), col('is_active', 'bool')],
      [CODE, NAME, rf.select('kind', REGISTRY_KINDS), rf.textarea('description', { maxLength: 2000 }), ACTIVE, SORT_ORDER],
    ),
    catalogTab(
      'membership-types',
      [...cols('code', 'name'), col('requires_board_decision', 'bool'), col('is_active', 'bool')],
      [
        CODE,
        NAME,
        rf.uuid('registry_type_id'),
        rf.uuid('fee_plan_id'),
        rf.bool('requires_board_decision'),
        ACTIVE,
        rf.textarea('description', { maxLength: 2000 }),
      ],
    ),
    catalogTab(
      'social-roles',
      [...cols('code', 'name'), col('is_single_holder', 'bool'), col('is_active', 'bool')],
      [CODE, NAME, rf.bool('is_single_holder'), ACTIVE, SORT_ORDER],
    ),
    catalogTab(
      'custom-fields',
      [...cols('code', 'label'), tagCol('type'), col('is_required', 'bool'), col('is_active', 'bool')],
      [CODE, req(rf.text('label', { maxLength: 255 })), rf.select('type', CUSTOM_FIELD_TYPES), rf.tags('options'), rf.bool('is_required'), ACTIVE, SORT_ORDER],
    ),
    catalogTab('families', [...cols('name')], [NAME]),
    catalogTab(
      'fee-plans',
      [...cols('code', 'name'), tagCol('frequency'), ...cols('amount', 'tax_rate'), col('is_active', 'bool')],
      [
        CODE,
        NAME,
        req(rf.select('frequency', FEE_FREQUENCIES)),
        req(rf.decimal('amount')),
        rf.integer('lessons_included', { min: 1 }),
        rf.integer('instalments', { min: 2 }),
        rf.decimal('tax_rate'),
        rf.uuid('revenue_account_id'),
        ACTIVE,
      ],
    ),
    catalogTab(
      'family-discounts',
      [...cols('name', 'from_position', 'percentage'), col('is_active', 'bool')],
      [NAME, req(rf.integer('from_position', { min: 2 })), req(rf.decimal('percentage', { positive: true })), ACTIVE],
    ),
    catalogTab('disciplines', [...cols('code', 'name'), col('is_active', 'bool')], [CODE, NAME, ACTIVE]),
    catalogTab('departments', [...cols('name'), col('is_active', 'bool')], [NAME, ACTIVE]),
    catalogTab(
      'resources',
      [...cols('name', 'kind', 'capacity'), col('is_active', 'bool')],
      [NAME, rf.text('kind', { maxLength: 30 }), rf.integer('capacity', { min: 1 }), rf.uuid('department_id'), ACTIVE],
    ),
    catalogTab(
      'access-areas',
      [...cols('code', 'name', 'capacity'), col('check_fee', 'bool'), col('check_certificate', 'bool'), col('check_course', 'bool'), col('is_active', 'bool')],
      [
        CODE,
        NAME,
        rf.integer('capacity', { min: 1 }),
        rf.uuid('department_id'),
        rf.bool('check_fee'),
        rf.bool('check_certificate'),
        rf.bool('check_course'),
        rf.select('required_certificate', CERTIFICATE_KINDS),
        rf.integer('course_margin_minutes', { min: 0 }),
        ACTIVE,
      ],
    ),
    catalogTab(
      'sections',
      [...cols('code', 'name', 'cost_center_id'), col('is_active', 'bool')],
      [CODE, NAME, req(rf.uuid('cost_center_id')), ACTIVE],
    ),
    catalogTab(
      'legal-parameters',
      [...cols('code', 'year', 'value', 'source_reference')],
      [
        req(rf.text('code', { maxLength: 80 })),
        req(rf.integer('year', { min: 2000 })),
        req(rf.decimal('value')),
        req(rf.text('source_reference', { maxLength: 500 })),
        rf.textarea('notes', { maxLength: 2000 }),
      ],
    ),
    catalogTab(
      'general-interest-activities',
      [tagCol('kind'), ...cols('reference', 'description', 'statute_clause'), col('is_active', 'bool')],
      [
        rf.select('kind', ACTIVITY_KINDS),
        req(rf.text('reference', { maxLength: 20 })),
        req(rf.text('description', { maxLength: 1000 })),
        rf.text('statute_clause', { maxLength: 255 }),
        rf.uuid('cost_center_id'),
        ACTIVE,
      ],
    ),
  ],
};

/** Catalogs of the people who work for the association: volunteers, trainings, shifts and sport collaborators. */
export const ASSOCIATIONS_WORK_CATALOGS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_WORK_CATALOGS',
  tabs: [
    catalogTab(
      'volunteers',
      [...cols('activity', 'category', 'member_id'), col('started_on', 'date'), col('ended_on', 'date'), col('is_occasional', 'bool')],
      [
        req(rf.uuid('member_id')),
        req(rf.text('activity', { maxLength: 255 })),
        rf.text('category', { maxLength: 100 }),
        req(rf.date('started_on')),
        rf.date('ended_on', { notBefore: 'started_on' }),
        rf.bool('is_occasional'),
        rf.text('insurer', { maxLength: 255 }),
        rf.text('insurance_policy', { maxLength: 100 }),
        rf.date('insurance_expires_on'),
        rf.textarea('notes', { maxLength: 2000 }),
      ],
    ),
    catalogTab(
      'volunteer-trainings',
      [...cols('title', 'volunteer_id'), col('completed_on', 'date'), col('expires_on', 'date')],
      [req(rf.uuid('volunteer_id')), req(rf.text('title', { maxLength: 255 })), req(rf.date('completed_on')), rf.date('expires_on', { notBefore: 'completed_on' })],
    ),
    catalogTab(
      'shifts',
      [...cols('title', 'service', 'location'), col('starts_at', 'datetime'), col('ends_at', 'datetime'), ...cols('required_volunteers'), tagCol('status')],
      [
        req(rf.text('title', { maxLength: 255 })),
        rf.text('service', { maxLength: 100 }),
        rf.text('location', { maxLength: 255 }),
        req(rf.datetime('starts_at')),
        req(rf.datetime('ends_at', { notBefore: 'starts_at', strictlyAfter: true })),
        rf.integer('required_volunteers', { min: 1 }),
        rf.select('status', ['planned', 'cancelled']),
        rf.textarea('notes', { maxLength: 2000 }),
      ],
    ),
    catalogTab(
      'sport-collaborators',
      [...cols('role', 'qualification', 'member_id'), col('starts_on', 'date'), col('ends_on', 'date')],
      [
        req(rf.uuid('member_id')),
        req(rf.text('role', { maxLength: 100 })),
        rf.text('qualification', { maxLength: 255 }),
        rf.uuid('discipline_id'),
        req(rf.date('starts_on')),
        rf.date('ends_on', { notBefore: 'starts_on' }),
        rf.text('insurer', { maxLength: 255 }),
        rf.text('insurance_policy', { maxLength: 100 }),
        rf.date('insurance_expires_on'),
        rf.textarea('notes', { maxLength: 2000 }),
      ],
    ),
    catalogTab(
      'sport-contracts',
      [...cols('kind', 'collaborator_id'), col('starts_on', 'date'), col('ends_on', 'date'), ...cols('agreed_amount'), tagCol('agreed_period'), tagCol('status')],
      [
        req(rf.uuid('collaborator_id')),
        req(rf.text('kind', { maxLength: 60 })),
        req(rf.date('starts_on')),
        rf.date('ends_on', { notBefore: 'starts_on' }),
        rf.decimal('agreed_amount'),
        rf.select('agreed_period', ['hour', 'day', 'month', 'season', 'total']),
        rf.textarea('description', { maxLength: 5000 }),
        rf.select('status', ['active', 'ended']),
      ],
    ),
  ],
};

/** Catalogs of fundraising: campaigns, donors, sponsors and the expense categories. */
export const ASSOCIATIONS_FUNDRAISING_CATALOGS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_FUNDRAISING_CATALOGS',
  tabs: [
    catalogTab(
      'campaigns',
      [...cols('code', 'name'), tagCol('kind'), col('starts_on', 'date'), col('ends_on', 'date'), ...cols('target_amount'), tagCol('status')],
      [
        CODE,
        NAME,
        rf.select('kind', CAMPAIGN_KINDS),
        rf.textarea('purpose', { maxLength: 5000 }),
        rf.date('starts_on'),
        rf.date('ends_on', { notBefore: 'starts_on' }),
        rf.decimal('target_amount'),
        rf.uuid('cost_center_id'),
        rf.uuid('revenue_account_id'),
        rf.uuid('expense_account_id'),
        rf.select('status', ['active', 'closed']),
      ],
    ),
    catalogTab(
      'donors',
      [...cols('name', 'tax_code', 'email'), tagCol('kind')],
      [
        rf.select('kind', ['person', 'organization']),
        req(rf.text('name', { maxLength: 255 })),
        rf.text('tax_code', { maxLength: 32 }),
        rf.text('email', { maxLength: 255 }),
        rf.text('address', { maxLength: 500 }),
        rf.uuid('member_id'),
        rf.uuid('contact_id'),
        rf.textarea('notes', { maxLength: 2000 }),
      ],
    ),
    catalogTab(
      'sponsors',
      [...cols('name', 'vat_number', 'email')],
      [NAME, rf.uuid('contact_id'), rf.text('vat_number', { maxLength: 30 }), rf.text('email', { maxLength: 255 }), rf.textarea('notes', { maxLength: 2000 })],
    ),
    catalogTab(
      'sponsor-contracts',
      [...cols('title', 'sponsor_id'), col('starts_on', 'date'), col('ends_on', 'date'), ...cols('amount'), tagCol('status')],
      [
        req(rf.uuid('sponsor_id')),
        req(rf.text('title', { maxLength: 255 })),
        req(rf.date('starts_on')),
        rf.date('ends_on', { notBefore: 'starts_on' }),
        req(rf.decimal('amount')),
        rf.textarea('consideration', { maxLength: 5000 }),
        rf.select('status', ['draft', 'active', 'ended']),
        rf.uuid('campaign_id'),
        rf.uuid('invoice_id'),
      ],
    ),
    catalogTab(
      'expense-categories',
      [tagCol('scope'), ...cols('code', 'name', 'sort_order')],
      [req(rf.select('scope', ['five_per_mille', 'campaign'])), req(rf.text('code', { maxLength: 50 })), NAME, SORT_ORDER],
    ),
  ],
};
