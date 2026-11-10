import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol, whenIn } from '@shared';

const MODULE = 'associations';

const MEMBERSHIP_FIELDS = [
  req(rf.uuid('member_id')),
  req(rf.uuid('year_id')),
  req(rf.uuid('membership_type_id')),
  rf.bool('activate'),
];

const REASON = [rf.textarea('reason', { maxLength: 500 })];

/** Memberships of the year: issue, activate, renew, suspend, cease and the membership card. */
const MEMBERSHIPS_PANEL: ResourcePanelConfig = {
  id: 'memberships',
  titleKey: 'RES.P.assoc_memberships',
  module: MODULE,
  detailPath: '/associations/memberships/{id}',
  list: {
    path: '/associations/memberships',
    columns: [...cols('card_number'), tagCol('status'), col('valid_from', 'date'), col('valid_to', 'date'), col('issued_on', 'date')],
  },
  create: act('POST', 'RES.A.new_membership', '/associations/memberships', { fields: MEMBERSHIP_FIELDS }),
  rowActions: [
    act('POST', 'RES.A.activate', '/associations/memberships/{id}/activate', {
      confirm: true,
      visible: whenIn('status', 'pending', 'suspended'),
    }),
    act('POST', 'RES.A.renew', '/associations/memberships/{id}/renew', {
      fields: [req(rf.uuid('year_id')), rf.uuid('membership_type_id'), rf.bool('activate')],
      visible: whenIn('status', 'active', 'expired'),
    }),
    act('POST', 'RES.A.suspend', '/associations/memberships/{id}/suspend', {
      fields: REASON,
      visible: whenIn('status', 'active'),
    }),
    act('POST', 'RES.A.cease', '/associations/memberships/{id}/cease', {
      fields: REASON,
      danger: true,
      visible: whenIn('status', 'active', 'suspended'),
    }),
    act('GET', 'RES.A.download_card', '/associations/memberships/{id}/card', { download: true }),
  ],
};

/** Registry of members with the credential, registry-type and social-role tools of a person. */
const MEMBERS_PANEL: ResourcePanelConfig = {
  id: 'members',
  titleKey: 'RES.P.assoc_members',
  module: MODULE,
  rowLink: { labelKey: 'RES.A.member_file', route: '/associations/members/{id}' },
  list: {
    path: '/associations/members',
    columns: [...cols('member_number', 'first_name', 'last_name', 'email'), tagCol('status')],
  },
  toolbar: [
    act('GET', 'RES.A.export_members', '/associations/members/export', { download: true }),
    act('DELETE', 'RES.A.revoke_credential', '/associations/credentials/{credential_id}', {
      fields: [req(rf.uuid('credential_id'))],
      danger: true,
    }),
  ],
  rowActions: [
    act('POST', 'RES.A.issue_qr', '/associations/members/{id}/qr', { showResult: true }),
    act('POST', 'RES.A.assign_badge', '/associations/members/{id}/badges', {
      fields: [req(rf.text('uid')), rf.datetime('expires_at')],
    }),
    act('POST', 'RES.A.add_registry_type', '/associations/members/{id}/registry-types', {
      fields: [req(rf.uuid('registry_type_id')), rf.uuid('year_id'), rf.date('valid_from'), rf.date('valid_to'), rf.textarea('notes')],
    }),
    act('POST', 'RES.A.add_social_role', '/associations/members/{id}/social-roles', {
      fields: [req(rf.uuid('social_role_id')), req(rf.date('valid_from')), rf.date('valid_to'), rf.textarea('notes')],
    }),
    act('POST', 'RES.A.send_area_link', '/associations/contacts/{contact_id}/area-link', {
      confirm: true,
      visible: (row) => typeof row['contact_id'] === 'string',
    }),
    act('DELETE', 'RES.A.revoke_area_link', '/associations/contacts/{contact_id}/area-link', {
      confirm: true,
      danger: true,
      visible: (row) => typeof row['contact_id'] === 'string',
    }),
  ],
};

export const ASSOC_MEMBERSHIPS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_MEMBERSHIPS',
  tabs: [MEMBERSHIPS_PANEL, MEMBERS_PANEL],
};

/** Panels of the file of one member (`{id}` comes from the route). */
const MEMBER_DOCUMENT_FIELDS = [
  req(rf.text('title', { maxLength: 255 })),
  req(rf.file('file')),
  rf.text('category', { maxLength: 50 }),
  rf.date('expires_on'),
  rf.bool('visible_to_member'),
];

const CERTIFICATE_FIELDS = [
  req(rf.select('kind', ['non_competitive', 'competitive'])),
  rf.uuid('discipline_id'),
  rf.date('issued_on'),
  req(rf.date('expires_on')),
  rf.text('physician'),
  rf.textarea('notes'),
  rf.file('file'),
];

const GUARDIAN_FIELDS = [
  rf.uuid('contact_id'),
  rf.text('first_name'),
  rf.text('last_name'),
  rf.text('email'),
  rf.text('phone'),
  rf.text('relationship', { maxLength: 50 }),
  rf.bool('is_primary'),
  rf.date('valid_from'),
  rf.date('valid_to'),
];

export const MEMBER_FILE_PANELS: readonly ResourcePanelConfig[] = [
  {
    id: 'guardians',
    titleKey: 'RES.P.assoc_guardians',
    module: MODULE,
    list: {
      path: '/associations/members/{id}/guardians',
      columns: [...cols('guardian_contact_id', 'relationship'), col('is_primary', 'bool'), col('valid_from', 'date'), col('valid_to', 'date')],
    },
    create: act('POST', 'RES.A.add_guardian', '/associations/members/{id}/guardians', { fields: GUARDIAN_FIELDS }),
    rowActions: [act('DELETE', 'RES.ACTION.DELETE', '/associations/guardians/{id}', { confirm: true, danger: true })],
  },
  {
    id: 'authorizations',
    titleKey: 'RES.P.assoc_authorizations',
    module: MODULE,
    list: {
      path: '/associations/members/{id}/authorizations',
      columns: [...cols('title'), tagCol('status'), col('valid_until', 'date'), col('signed_at', 'datetime')],
    },
    create: act('POST', 'RES.A.new_authorization', '/associations/members/{id}/authorizations', {
      fields: [req(rf.text('title')), req(rf.textarea('body')), rf.date('valid_until')],
    }),
    rowActions: [
      act('POST', 'RES.A.revoke', '/associations/authorizations/{id}/revoke', {
        confirm: true,
        danger: true,
        visible: whenIn('status', 'pending', 'signed'),
      }),
    ],
  },
  {
    id: 'documents',
    titleKey: 'RES.P.assoc_documents',
    module: MODULE,
    list: {
      path: '/associations/members/{id}/documents',
      columns: [...cols('title'), tagCol('category'), col('expires_on', 'date'), col('visible_to_member', 'bool')],
    },
    create: act('POST', 'RES.A.upload_document', '/associations/members/{id}/documents', { fields: MEMBER_DOCUMENT_FIELDS }),
    rowActions: [
      act('GET', 'RES.A.download', '/associations/member-documents/{id}/download', { download: true }),
      act('DELETE', 'RES.ACTION.DELETE', '/associations/member-documents/{id}', { confirm: true, danger: true }),
    ],
  },
  {
    id: 'certificates',
    titleKey: 'RES.P.assoc_certificates',
    module: MODULE,
    list: {
      path: '/associations/members/{id}/certificates',
      columns: [tagCol('kind'), col('issued_on', 'date'), col('expires_on', 'date'), col('is_expired', 'bool'), col('has_file', 'bool')],
    },
    create: act('POST', 'RES.A.add_certificate', '/associations/members/{id}/certificates', { fields: CERTIFICATE_FIELDS }),
    rowActions: [
      act('GET', 'RES.A.download', '/associations/certificates/{id}/download', { download: true, visible: (row) => row['has_file'] === true }),
      act('DELETE', 'RES.ACTION.DELETE', '/associations/certificates/{id}', { confirm: true, danger: true }),
    ],
  },
];
