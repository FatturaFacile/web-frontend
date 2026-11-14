import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol, whenIn } from '@shared';

const MODULE = 'associations';

const FORM_FIELD_DEFINITIONS = rf.lines(
  'fields',
  [
    req(rf.text('code', { maxLength: 50 })),
    req(rf.text('label', { maxLength: 255 })),
    rf.select('type', ['text', 'number', 'date', 'boolean', 'select']),
    rf.bool('required'),
    rf.tags('options'),
  ],
  { labelKey: 'RES.F.form_fields' },
);

const FORM_FIELDS = [
  req(rf.text('title', { maxLength: 255 })),
  rf.textarea('description', { maxLength: 5000 }),
  req(rf.uuid('year_id')),
  req(rf.uuid('membership_type_id')),
  rf.select('approval_mode', ['automatic', 'board']),
  rf.bool('is_active', { defaultValue: true }),
  rf.datetime('opens_at'),
  rf.datetime('closes_at', { notBefore: 'opens_at' }),
  FORM_FIELD_DEFINITIONS,
];

const DECISION_FIELDS = [rf.text('reference', { maxLength: 255 }), rf.textarea('notes', { maxLength: 1000 })];

/** Public enrolment forms: fields, documents to fill in and the open window. */
const FORMS_PANEL: ResourcePanelConfig = {
  id: 'enrolment-forms',
  titleKey: 'RES.P.assoc_enrolment_forms',
  module: MODULE,
  detailPath: '/associations/enrolment-forms/{id}',
  list: {
    path: '/associations/enrolment-forms',
    columns: [...cols('title', 'public_token'), tagCol('approval_mode'), col('is_active', 'bool'), col('opens_at', 'datetime'), col('closes_at', 'datetime')],
  },
  create: act('POST', 'RES.A.new_enrolment_form', '/associations/enrolment-forms', { fields: FORM_FIELDS }),
  toolbar: [
    act('DELETE', 'RES.A.remove_form_document', '/associations/enrolment-form-documents/{document_id}', {
      fields: [req(rf.uuid('document_id'))],
      danger: true,
    }),
  ],
  rowActions: [
    act('PUT', 'RES.ACTION.EDIT', '/associations/enrolment-forms/{id}', { prefill: true, fields: FORM_FIELDS }),
    act('POST', 'RES.A.add_form_document', '/associations/enrolment-forms/{id}/documents', {
      fields: [
        req(rf.text('title', { maxLength: 255 })),
        req(rf.select('mode', ['required', 'optional', 'download_only'])),
        rf.integer('sort_order', { min: 0 }),
        rf.file('file'),
      ],
    }),
    act('DELETE', 'RES.ACTION.DELETE', '/associations/enrolment-forms/{id}', { confirm: true, danger: true }),
  ],
};

/** Applications received from the public form, decided by the board or automatically. */
const APPLICATIONS_PANEL: ResourcePanelConfig = {
  id: 'enrolment-applications',
  titleKey: 'RES.P.assoc_enrolment_applications',
  module: MODULE,
  detailPath: '/associations/enrolment-applications/{id}',
  list: {
    path: '/associations/enrolment-applications',
    columns: [...cols('form_id', 'member_id'), tagCol('status'), col('decided_at', 'datetime'), col('created_at', 'datetime')],
  },
  toolbar: [
    act('GET', 'RES.A.download_upload', '/associations/enrolment-uploads/{upload_id}/download', {
      fields: [req(rf.uuid('upload_id'))],
      download: true,
    }),
  ],
  rowActions: [
    act('POST', 'RES.A.approve', '/associations/enrolment-applications/{id}/approve', {
      fields: DECISION_FIELDS,
      visible: whenIn('status', 'submitted', 'pending_board'),
    }),
    act('POST', 'RES.A.reject', '/associations/enrolment-applications/{id}/reject', {
      fields: DECISION_FIELDS,
      danger: true,
      visible: whenIn('status', 'submitted', 'pending_board'),
    }),
  ],
};

export const ASSOC_ENROLMENT_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_ENROLMENT',
  tabs: [FORMS_PANEL, APPLICATIONS_PANEL],
};
