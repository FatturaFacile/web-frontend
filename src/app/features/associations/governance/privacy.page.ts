import { act, col, cols, ResourceAction, ResourcePageConfig, ResourceRow, rf, req, tagCol, whenIn } from '@shared';
import { catalogTab } from './catalog-tab';

const LEGAL_BASES = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'] as const;
const CONSENT_METHODS = ['online_form', 'paper_form', 'email', 'member_area', 'other'] as const;
const REQUEST_KINDS = ['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'] as const;
const SUBJECT_ROLES = ['controller', 'processor', 'dpo', 'authorized', 'other'] as const;
const ASSET_KINDS = ['physical', 'digital', 'human'] as const;

const ACTIVITY_FIELDS = [
  req(rf.text('name', { maxLength: 255 })),
  rf.textarea('description'),
  req(rf.tags('data_subjects')),
  req(rf.tags('data_categories')),
  rf.bool('special_categories'),
  req(rf.tags('purposes')),
  req(rf.multiselect('legal_bases', LEGAL_BASES)),
  rf.tags('collection_methods'),
  rf.textarea('storage'),
  req(rf.text('retention', { maxLength: 500 })),
  rf.tags('recipients'),
  rf.text('transfers_outside_eu', { maxLength: 500 }),
  rf.textarea('security_measures'),
  rf.textarea('end_of_processing'),
];

const CONSENT_FIELDS = [
  req(rf.uuid('activity_id')),
  rf.uuid('member_id'),
  rf.uuid('contact_id'),
  req(rf.text('purpose', { maxLength: 500 })),
  req(rf.select('method', CONSENT_METHODS)),
  req(rf.text('text_version', { maxLength: 100 })),
  req(rf.textarea('proof')),
  rf.datetime('given_at'),
];

const REQUEST_FIELDS = [
  req(rf.select('kind', REQUEST_KINDS)),
  rf.uuid('member_id'),
  req(rf.text('requester_name')),
  rf.text('requester_contact'),
  rf.textarea('details'),
  rf.datetime('received_at'),
];

const OUTCOME = [req(rf.textarea('outcome'))];

const SUBJECT_FIELDS = [
  req(rf.select('role', SUBJECT_ROLES)),
  req(rf.text('name', { maxLength: 255 })),
  rf.text('representative', { maxLength: 255 }),
  rf.text('tax_code', { maxLength: 32 }),
  rf.text('email', { maxLength: 255 }),
  rf.text('address', { maxLength: 500 }),
  rf.uuid('member_id'),
  rf.textarea('scope'),
  rf.date('appointed_on'),
  rf.date('ended_on'),
];

const ASSET_FIELDS = [
  req(rf.text('name', { maxLength: 255 })),
  req(rf.select('kind', ASSET_KINDS)),
  rf.text('location', { maxLength: 255 }),
  rf.textarea('description'),
  req(rf.integer('confidentiality', { min: 1 })),
  req(rf.integer('integrity', { min: 1 })),
  req(rf.integer('availability', { min: 1 })),
  rf.text('owner', { maxLength: 255 }),
  rf.tags('activity_family_ids'),
];

const isActive = (row: ResourceRow): boolean => !row['withdrawn_at'];

const withdraw: ResourceAction = act('POST', 'RES.A.assoc_withdraw_consent', '/associations/privacy/consents/{id}/withdraw', {
  confirm: true,
  danger: true,
  visible: isActive,
});

/** GDPR tools of the association: processing register, consents, data subject requests and privacy roles. */
export const ASSOCIATIONS_PRIVACY_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_PRIVACY',
  tabs: [
    {
      id: 'activities',
      titleKey: 'RES.P.assoc_activities',
      module: 'associations',
      list: {
        path: '/associations/privacy/activities',
        filters: [rf.select('current', ['true', 'false'])],
        columns: [...cols('name', 'version'), tagCol('status'), col('special_categories', 'bool'), ...cols('retention'), col('finalized_at', 'datetime')],
      },
      create: act('POST', 'RES.A.assoc_new_activity', '/associations/privacy/activities', { fields: ACTIVITY_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/associations/privacy/activities/{id}', {
          prefill: true,
          fields: ACTIVITY_FIELDS,
          visible: whenIn('status', 'draft'),
        }),
        act('POST', 'RES.A.assoc_finalize_activity', '/associations/privacy/activities/{id}/finalize', {
          confirm: true,
          visible: whenIn('status', 'draft'),
        }),
        act('POST', 'RES.A.assoc_new_version', '/associations/privacy/activities/{id}/versions', {
          confirm: true,
          visible: whenIn('status', 'final'),
        }),
        act('GET', 'RES.A.assoc_notice', '/associations/privacy/activities/{id}/notice', { showResult: true }),
        act('GET', 'RES.A.assoc_notice_pdf', '/associations/privacy/activities/{id}/notice/pdf', { download: true }),
      ],
    },
    {
      id: 'register',
      titleKey: 'RES.P.assoc_register',
      module: 'associations',
      list: { path: '/associations/privacy/register', columns: [], report: true },
      toolbar: [
        act('GET', 'RES.A.assoc_register_csv', '/associations/privacy/register/csv', { download: true }),
        act('GET', 'RES.A.assoc_register_pdf', '/associations/privacy/register/pdf', { download: true }),
      ],
    },
    {
      id: 'consents',
      titleKey: 'RES.P.assoc_consents',
      module: 'associations',
      list: {
        path: '/associations/privacy/consents',
        columns: [...cols('purpose'), tagCol('method'), ...cols('text_version'), col('given_at', 'datetime'), col('withdrawn_at', 'datetime'), ...cols('member_id')],
      },
      create: act('POST', 'RES.A.assoc_record_consent', '/associations/privacy/consents', { fields: CONSENT_FIELDS }),
      rowActions: [withdraw],
    },
    {
      id: 'requests',
      titleKey: 'RES.P.assoc_requests',
      module: 'associations',
      list: {
        path: '/associations/privacy/requests',
        filters: [rf.select('overdue', ['true', 'false'])],
        columns: [tagCol('kind'), ...cols('requester_name'), tagCol('status'), col('received_at', 'datetime'), col('due_on', 'date'), col('extended_due_on', 'date')],
      },
      create: act('POST', 'RES.A.assoc_new_request', '/associations/privacy/requests', { fields: REQUEST_FIELDS }),
      rowActions: [
        act('POST', 'RES.A.assoc_extend_request', '/associations/privacy/requests/{id}/extend', {
          fields: [req(rf.text('reason', { maxLength: 500 }))],
          visible: whenIn('status', 'received', 'in_progress'),
        }),
        act('GET', 'RES.A.assoc_erasure_preview', '/associations/privacy/requests/{id}/erasure-preview', {
          showResult: true,
          visible: whenIn('kind', 'erasure'),
        }),
        act('GET', 'RES.A.assoc_export_request', '/associations/privacy/requests/{id}/export', {
          showResult: true,
          visible: whenIn('kind', 'access', 'portability'),
        }),
        act('POST', 'RES.A.assoc_complete_request', '/associations/privacy/requests/{id}/complete', {
          fields: OUTCOME,
          visible: whenIn('status', 'received', 'in_progress', 'extended'),
        }),
        act('POST', 'RES.A.assoc_reject_request', '/associations/privacy/requests/{id}/reject', {
          fields: OUTCOME,
          danger: true,
          visible: whenIn('status', 'received', 'in_progress', 'extended'),
        }),
      ],
    },
    catalogTab(
      'privacy-subjects',
      [tagCol('role'), ...cols('name', 'email'), col('appointed_on', 'date'), col('ended_on', 'date')],
      SUBJECT_FIELDS,
      [act('GET', 'RES.A.assoc_appointment_letter', '/associations/privacy/subjects/{id}/appointment', { download: true })],
    ),
    catalogTab(
      'data-assets',
      [...cols('name'), tagCol('kind'), ...cols('location', 'confidentiality', 'integrity', 'availability', 'owner')],
      ASSET_FIELDS,
    ),
  ],
};
