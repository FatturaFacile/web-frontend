import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol } from '@shared';

const MODULE = 'associations';

const DAYS_FILTER = [rf.integer('days', { min: 1 })];

const CERTIFICATE_COLUMNS = [
  ...cols('member_name'),
  tagCol('kind'),
  col('issued_on', 'date'),
  col('expires_on', 'date'),
  col('is_expired', 'bool'),
  col('has_file', 'bool'),
];

const CERTIFICATE_ACTIONS = [
  act('GET', 'RES.A.download', '/associations/certificates/{id}/download', { download: true, visible: (row) => row['has_file'] === true }),
  act('DELETE', 'RES.ACTION.DELETE', '/associations/certificates/{id}', { confirm: true, danger: true }),
];

const SHIFT_ASSIGNEE = [req(rf.uuid('volunteer_id')), rf.bool('is_available', { defaultValue: true })];

/** Medical certificates close to the deadline and expired ones. */
const EXPIRING_CERTIFICATES_PANEL: ResourcePanelConfig = {
  id: 'certificates-expiring',
  titleKey: 'RES.P.assoc_certificates_expiring',
  module: MODULE,
  list: { path: '/associations/certificates/expiring', columns: CERTIFICATE_COLUMNS },
  rowActions: CERTIFICATE_ACTIONS,
};

const EXPIRED_CERTIFICATES_PANEL: ResourcePanelConfig = {
  id: 'certificates-expired',
  titleKey: 'RES.P.assoc_certificates_expired',
  module: MODULE,
  list: { path: '/associations/certificates/expired', columns: CERTIFICATE_COLUMNS },
  rowActions: CERTIFICATE_ACTIONS,
};

/** Documents of the members close to their expiry. */
const EXPIRING_DOCUMENTS_PANEL: ResourcePanelConfig = {
  id: 'member-documents-expiring',
  titleKey: 'RES.P.assoc_documents_expiring',
  module: MODULE,
  list: {
    path: '/associations/member-documents/expiring',
    filters: DAYS_FILTER,
    columns: [...cols('title', 'member_id'), tagCol('category'), col('expires_on', 'date')],
  },
  rowActions: [
    act('GET', 'RES.A.download', '/associations/member-documents/{id}/download', { download: true }),
    act('DELETE', 'RES.ACTION.DELETE', '/associations/member-documents/{id}', { confirm: true, danger: true }),
  ],
};

export const ASSOC_COMPLIANCE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_COMPLIANCE',
  tabs: [EXPIRING_CERTIFICATES_PANEL, EXPIRED_CERTIFICATES_PANEL, EXPIRING_DOCUMENTS_PANEL],
};

/** Volunteer shifts that need attention and the tools to cover them. */
const SHIFTS_PANEL: ResourcePanelConfig = {
  id: 'shifts',
  titleKey: 'RES.P.assoc_shifts',
  module: MODULE,
  list: {
    path: '/associations/shifts/attention',
    filters: DAYS_FILTER,
    columns: [
      col('coverage.shift_id', 'text', 'RES.F.shift_id'),
      col('shift.title', 'text', 'RES.F.title'),
      col('shift.starts_at', 'datetime', 'RES.F.starts_at'),
      col('coverage.required', 'text', 'RES.F.required'),
      col('coverage.covered', 'text', 'RES.F.covered'),
      col('coverage.missing', 'text', 'RES.F.missing'),
      col('coverage.substitutions_requested', 'text', 'RES.F.substitutions_requested'),
    ],
  },
  toolbar: [
    act('GET', 'RES.A.shift_coverage', '/associations/shifts/{shift_id}/coverage', {
      fields: [req(rf.uuid('shift_id'))],
      showResult: true,
    }),
    act('POST', 'RES.A.set_availability', '/associations/shifts/{shift_id}/availability', {
      fields: [req(rf.uuid('shift_id')), ...SHIFT_ASSIGNEE],
    }),
    act('POST', 'RES.A.assign_volunteer', '/associations/shifts/{shift_id}/assignments', {
      fields: [req(rf.uuid('shift_id')), ...SHIFT_ASSIGNEE],
    }),
    act('POST', 'RES.A.substitution_request', '/associations/shift-assignments/{assignment_id}/substitution-request', {
      fields: [req(rf.uuid('assignment_id'))],
    }),
    act('POST', 'RES.A.substitute', '/associations/shift-assignments/{assignment_id}/substitute', {
      fields: [req(rf.uuid('assignment_id')), ...SHIFT_ASSIGNEE],
    }),
  ],
};

export const ASSOC_VOLUNTEERS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_VOLUNTEERS',
  tabs: [SHIFTS_PANEL],
};

/** Access control: reader devices, entrance log and occupancy of the areas. */
const DEVICES_PANEL: ResourcePanelConfig = {
  id: 'access-devices',
  titleKey: 'RES.P.assoc_access_devices',
  module: MODULE,
  list: {
    path: '/associations/access-devices',
    columns: [...cols('name', 'device_key', 'area_id'), tagCol('direction'), col('is_active', 'bool'), col('last_seen_at', 'datetime')],
  },
  create: act('POST', 'RES.A.new_access_device', '/associations/access-devices', {
    fields: [req(rf.uuid('area_id')), req(rf.text('name')), rf.select('direction', ['in', 'out', 'both'])],
    showResult: true,
  }),
  toolbar: [
    act('GET', 'RES.A.occupancy', '/associations/access-areas/{area_id}/occupancy', {
      fields: [req(rf.uuid('area_id'))],
      showResult: true,
    }),
  ],
  rowActions: [
    act('POST', 'RES.A.rotate_secret', '/associations/access-devices/{id}/rotate-secret', { confirm: true, showResult: true }),
    act('POST', 'RES.A.deactivate', '/associations/access-devices/{id}/deactivate', {
      confirm: true,
      danger: true,
      visible: (row) => row['is_active'] !== false,
    }),
  ],
};

const LOGS_PANEL: ResourcePanelConfig = {
  id: 'access-logs',
  titleKey: 'RES.P.assoc_access_logs',
  module: MODULE,
  list: {
    path: '/associations/access-logs',
    columns: [col('occurred_at', 'datetime'), ...cols('member_id', 'area_id'), tagCol('direction'), tagCol('decision'), tagCol('reason_code')],
  },
};

export const ASSOC_ACCESS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_ACCESS',
  tabs: [DEVICES_PANEL, LOGS_PANEL],
};
