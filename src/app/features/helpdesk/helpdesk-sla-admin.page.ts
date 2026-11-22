import { HOLIDAY_COUNTRIES, HOLIDAY_REGIONS } from '@core';
import { act, col, cols, ResourcePageConfig, rf, req } from '@shared';

const TARGETS = ['response', 'next_update', 'resolution'] as const;
const ACTIONS = ['notify', 'reassign_team', 'raise_priority'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

/** Every canton and region the holiday catalogue knows; the API refuses a code that does not belong to the country. */
export const HOLIDAY_REGION_OPTIONS = [...HOLIDAY_REGIONS.CH, ...HOLIDAY_REGIONS.IT] as const;

const STEP_FIELDS = [
  req(rf.select('target', TARGETS)),
  req(rf.integer('threshold_percent', { min: 1, max: 1000 })),
  req(rf.select('action', ACTIONS)),
  rf.tags('notify_user_ids'),
  rf.bool('notify_team_lead'),
  rf.uuid('team_id'),
  rf.select('priority', PRIORITIES),
];

const CHAIN_FIELDS = [
  req(rf.text('code', { maxLength: 60 })),
  req(rf.text('name', { maxLength: 150 })),
  rf.bool('is_active', { defaultValue: true }),
  req(rf.lines('steps', STEP_FIELDS)),
];

const POLICY_SETTINGS_FIELDS = [
  req(rf.uuid('id', { labelKey: 'RES.F.sla_policy_id' })),
  rf.lookup('escalation_chain_id', 'escalationChains'),
  rf.integer('next_update_interval_minutes', { min: 1 }),
  rf.bool('pause_on_on_hold'),
];

/** SLA administration: escalation chains, the settings of an SLA policy and the preview of the holidays a calendar skips. */
export const HELPDESK_SLA_ADMIN_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.HELPDESK_SLA_ADMIN',
  tabs: [
    {
      id: 'escalation-chains',
      titleKey: 'RES.P.escalation_chains',
      module: 'service',
      list: {
        path: '/esm/helpdesk/escalation-chains',
        columns: [...cols('code', 'name'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_escalation_chain', '/esm/helpdesk/escalation-chains', {
        fields: CHAIN_FIELDS,
      }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/helpdesk/escalation-chains/{id}', {
          prefill: true,
          fields: CHAIN_FIELDS,
        }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/helpdesk/escalation-chains/{id}', {
          confirm: true,
          danger: true,
        }),
      ],
      toolbar: [
        act('PUT', 'RES.A.sla_policy_settings', '/esm/helpdesk/sla-policies/{id}/settings', {
          fields: POLICY_SETTINGS_FIELDS,
          showResult: true,
        }),
      ],
    },
    {
      id: 'holidays',
      titleKey: 'RES.P.holiday_preview',
      module: 'service',
      list: {
        path: '/esm/helpdesk/holidays',
        report: true,
        manual: true,
        columns: [],
        filters: [
          req(rf.select('country', HOLIDAY_COUNTRIES)),
          rf.select('region', HOLIDAY_REGION_OPTIONS),
          rf.integer('year', { min: 2000, max: 2100 }),
        ],
      },
    },
  ],
};
