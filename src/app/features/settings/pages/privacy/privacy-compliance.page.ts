import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const DSR_TYPES = ['access', 'portability', 'rectification', 'erasure', 'restriction', 'objection'] as const;
const REGULATIONS = ['nLPD', 'GDPR'] as const;
const SUBJECT_TYPES = ['contact', 'employee', 'lead', 'user', 'member', 'child', 'visitor', 'applicant'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/** Data subject requests lifecycle, breach notifications, retention policies and the personal data map. */
export const PRIVACY_COMPLIANCE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PRIVACY_COMPLIANCE',
  tabs: [
    {
      id: 'dsr',
      titleKey: 'RES.P.privacy_dsr',
      module: 'system',
      list: {
        path: '/settings/privacy/data-subject-requests',
        columns: [tagCol('request_type'), tagCol('regulation'), tagCol('subject_type'), tagCol('status'), col('deadline_at', 'date')],
      },
      detailPath: '/settings/privacy/data-subject-requests/{id}',
      create: act('POST', 'RES.A.privacy_new_dsr', '/settings/privacy/data-subject-requests', {
        fields: [
          req(rf.select('request_type', DSR_TYPES)),
          rf.select('regulation', ['nLPD', 'GDPR', 'both']),
          req(rf.select('subject_type', SUBJECT_TYPES)),
          req(rf.uuid('subject_id')),
          rf.text('requester_reference', { maxLength: 190 }),
          rf.textarea('notes', { maxLength: 4000 }),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.privacy_verify_identity', '/settings/privacy/data-subject-requests/{id}/verify-identity', {
          fields: [req(rf.text('method', { maxLength: 190 })), rf.textarea('note', { maxLength: 2000 })],
        }),
        act('POST', 'RES.A.privacy_start_dsr', '/settings/privacy/data-subject-requests/{id}/start'),
        act('POST', 'RES.A.privacy_extend_dsr', '/settings/privacy/data-subject-requests/{id}/extend', {
          fields: [req(rf.integer('days', { min: 1 })), req(rf.textarea('reason', { maxLength: 2000 }))],
        }),
        act('POST', 'RES.A.privacy_complete_dsr', '/settings/privacy/data-subject-requests/{id}/complete', {
          fields: [rf.textarea('response_summary', { maxLength: 4000 })],
        }),
        act('POST', 'RES.A.privacy_reject_dsr', '/settings/privacy/data-subject-requests/{id}/reject', {
          fields: [req(rf.textarea('reason', { maxLength: 2000 }))],
          danger: true,
        }),
        act('GET', 'RES.A.privacy_export_dsr', '/settings/privacy/data-subject-requests/{id}/export', { download: true }),
      ],
    },
    {
      id: 'breaches',
      titleKey: 'RES.P.privacy_breaches',
      module: 'system',
      list: {
        path: '/settings/privacy/breaches',
        columns: [...cols('title'), tagCol('severity'), col('discovered_at', 'datetime'), col('notification_deadline_at', 'datetime')],
      },
      detailPath: '/settings/privacy/breaches/{id}',
      create: act('POST', 'RES.A.privacy_new_breach', '/settings/privacy/breaches', {
        fields: [
          req(rf.text('title', { maxLength: 190 })),
          req(rf.select('severity', SEVERITIES)),
          rf.datetime('discovered_at'),
          rf.integer('affected_records_count', { min: 0 }),
          rf.integer('affected_subjects_count', { min: 0 }),
          rf.textarea('description', { maxLength: 4000 }),
          req(rf.tags('data_categories')),
          rf.textarea('likely_consequences', { maxLength: 4000 }),
          rf.textarea('mitigation_measures', { maxLength: 4000 }),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.privacy_contain_breach', '/settings/privacy/breaches/{id}/contain', {
          fields: [rf.textarea('mitigation_measures', { maxLength: 4000 })],
        }),
        act('POST', 'RES.A.privacy_notify_authority', '/settings/privacy/breaches/{id}/notify-authority', {
          fields: [req(rf.select('regulation', REGULATIONS)), rf.datetime('notified_at'), rf.textarea('delay_reason', { maxLength: 2000 })],
        }),
        act('POST', 'RES.A.privacy_notification_not_required', '/settings/privacy/breaches/{id}/notification-not-required', {
          fields: [req(rf.textarea('reason', { maxLength: 2000 }))],
        }),
        act('POST', 'RES.A.privacy_notify_subjects', '/settings/privacy/breaches/{id}/notify-subjects', {
          fields: [rf.datetime('notified_at')],
        }),
        act('POST', 'RES.A.privacy_close_breach', '/settings/privacy/breaches/{id}/close', { confirm: true }),
      ],
    },
    {
      id: 'retention',
      titleKey: 'RES.P.privacy_retention',
      module: 'system',
      list: {
        path: '/settings/privacy/retention-policies',
        columns: [...cols('entry_key', 'retention_days'), tagCol('action'), col('is_active', 'bool'), col('last_run_at', 'datetime')],
      },
      rowActions: [
        act('PUT', 'RES.A.privacy_edit_retention', '/settings/privacy/retention-policies/{entry_key}', {
          fields: [req(rf.integer('retention_days', { min: 1 })), rf.bool('is_active'), rf.textarea('legal_basis_note', { maxLength: 2000 })],
          prefill: true,
        }),
        act('DELETE', 'RES.A.privacy_delete_retention', '/settings/privacy/retention-policies/{entry_key}', { confirm: true, danger: true }),
      ],
      toolbar: [
        act('POST', 'RES.A.privacy_run_retention', '/settings/privacy/retention-runs', {
          fields: [rf.bool('dry_run', { defaultValue: true }), rf.text('entry_key', { maxLength: 190 })],
          showResult: true,
        }),
      ],
    },
    {
      id: 'retention-suggestions',
      titleKey: 'RES.P.privacy_retention_suggestions',
      module: 'system',
      list: {
        path: '/settings/privacy/retention-suggestions',
        columns: [...cols('entry_key', 'label', 'suggested_retention_days', 'basis'), col('requires_confirmation', 'bool')],
      },
      rowActions: [
        act('POST', 'RES.A.privacy_adopt_suggestion', '/settings/privacy/retention-suggestions/{entry_key}/adopt', {
          fields: [req(rf.bool('confirm', { defaultValue: true })), rf.integer('retention_days', { min: 1 }), rf.bool('activate')],
        }),
      ],
    },
    {
      id: 'retention-runs',
      titleKey: 'RES.P.privacy_retention_runs',
      module: 'system',
      list: {
        path: '/settings/privacy/retention-runs',
        columns: [...cols('entry_key', 'matched_count', 'processed_count'), col('dry_run', 'bool'), tagCol('status'), col('started_at', 'datetime')],
      },
    },
    {
      id: 'privacy-settings',
      titleKey: 'RES.P.privacy_settings',
      module: 'system',
      list: { path: '/settings/privacy/settings', columns: [], report: true },
      toolbar: [
        act('PUT', 'RES.A.privacy_edit_settings', '/settings/privacy/settings', {
          fields: [req(rf.integer('dsr_deadline_days', { min: 1, max: 365 }))],
        }),
      ],
    },
    {
      id: 'data-map',
      titleKey: 'RES.P.privacy_data_map',
      module: 'system',
      list: { path: '/settings/privacy/data-map', columns: [], report: true, manual: true },
    },
  ],
};
