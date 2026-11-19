import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const PAYSLIP_TYPES = ['payslip', 'cu', 'lohnausweis'] as const;

const WORK_SITE_FIELDS = [
  req(rf.text('name', { maxLength: 150 })),
  req(rf.decimal('latitude', { min: -90, max: 90 })),
  req(rf.decimal('longitude', { min: -180, max: 180 })),
  rf.integer('radius_meters', { min: 10, max: 5000 }),
  rf.bool('is_active', { defaultValue: true }),
];

const SHIFT_FIELDS = [
  req(rf.uuid('user_id')),
  rf.uuid('work_site_id'),
  req(rf.datetime('starts_at')),
  req(rf.datetime('ends_at', { notBefore: 'starts_at', strictlyAfter: true })),
  rf.select('shift_type', ['regular', 'night', 'on_call', 'holiday']),
  rf.textarea('notes', { maxLength: 500 }),
];

/** Mobile companion app, back-office side: registered devices, quick approvals, payslip delivery, work sites and shifts. */
export const MOBILE_ADMIN_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.MOBILE_ADMIN',
  tabs: [
    {
      id: 'devices',
      titleKey: 'RES.P.mobile_devices',
      module: 'hr',
      list: {
        path: '/mobile/admin/devices',
        columns: [...cols('device_name', 'user.name'), tagCol('platform'), col('app_version'), col('last_active_at', 'datetime'), col('is_revoked', 'bool')],
      },
      rowActions: [
        act('DELETE', 'RES.A.mobile_revoke_device', '/mobile/devices/{id}', {
          confirm: true,
          danger: true,
          visible: (row) => !row['is_revoked'],
        }),
      ],
    },
    {
      id: 'approvals',
      titleKey: 'RES.P.mobile_approvals',
      module: 'hr',
      list: { path: '/mobile/approvals', columns: [...cols('node.name', 'instance.subject_type'), tagCol('status'), col('due_at', 'datetime')] },
      rowActions: [
        act('POST', 'RES.A.mobile_decide_approval', '/mobile/approvals/{id}/decision', {
          fields: [req(rf.select('decision', ['approved', 'rejected'])), rf.textarea('comment', { maxLength: 1000 })],
        }),
      ],
    },
    {
      id: 'payslips',
      titleKey: 'RES.P.mobile_payslips',
      module: 'payroll',
      list: {
        path: '/mobile/payslips',
        filters: [rf.select('type', PAYSLIP_TYPES), rf.integer('year', { min: 2000, max: 2100 })],
        columns: [...cols('title'), tagCol('document_type'), col('period_year'), col('period_month'), col('read_at', 'datetime')],
      },
      toolbar: [
        act('POST', 'RES.A.mobile_publish_payslip', '/mobile/admin/payslips', {
          fields: [
            req(rf.uuid('user_id')),
            req(rf.select('document_type', PAYSLIP_TYPES)),
            req(rf.integer('period_year', { min: 2000, max: 2100 })),
            rf.integer('period_month', { min: 1, max: 12 }),
            req(rf.text('title', { maxLength: 191 })),
            rf.select('country', ['IT', 'CH']),
            req(rf.file('file')),
          ],
        }),
      ],
      rowActions: [act('GET', 'RES.A.mobile_download_payslip', '/mobile/payslips/{id}/download', { download: true })],
    },
    {
      id: 'work-sites',
      titleKey: 'RES.P.mobile_work_sites',
      module: 'hr',
      list: { path: '/mobile/work-sites', columns: [...cols('name'), col('latitude', 'decimal'), col('longitude', 'decimal'), col('radius_meters'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.mobile_new_work_site', '/mobile/work-sites', { fields: WORK_SITE_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/mobile/work-sites/{id}', { prefill: true, fields: WORK_SITE_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/mobile/work-sites/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'shifts',
      titleKey: 'RES.P.mobile_shifts',
      module: 'hr',
      list: {
        path: '/mobile/shifts',
        filters: [rf.date('from'), rf.date('to', { notBefore: 'from' }), rf.uuid('user_id')],
        columns: [...cols('user_name', 'work_site_name'), tagCol('shift_type'), col('starts_at', 'datetime'), col('ends_at', 'datetime')],
      },
      create: act('POST', 'RES.A.mobile_new_shift', '/mobile/shifts', { fields: SHIFT_FIELDS }),
      rowActions: [act('DELETE', 'RES.ACTION.DELETE', '/mobile/shifts/{id}', { confirm: true, danger: true })],
    },
  ],
};

