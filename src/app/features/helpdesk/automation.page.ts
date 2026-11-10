import { act, col, cols, ResourcePageConfig, rf, req } from '@shared';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const STRATEGIES = ['manual', 'round_robin', 'least_loaded'] as const;
const NOTIFICATION_EVENTS = [
  'ticket_created',
  'ticket_replied',
  'status_changed',
  'ticket_assigned',
  'sla_warning',
  'sla_breached',
] as const;

const ROUTING_FIELDS = [
  req(rf.text('name')),
  rf.integer('position', { min: 0 }),
  rf.bool('is_active', { defaultValue: true }),
  rf.bool('stop_processing'),
  rf.json('conditions', { labelKey: 'RES.F.routing_conditions' }),
  req(rf.json('actions', { labelKey: 'RES.F.routing_actions' })),
];

const BUSINESS_HOURS_FIELDS = [
  req(rf.text('code')),
  req(rf.text('name')),
  req(rf.text('timezone')),
  req(rf.json('weekly_schedule')),
  rf.tags('holidays'),
  rf.uuid('hr_holiday_calendar_id'),
  rf.bool('is_active', { defaultValue: true }),
];

const SETTINGS_FIELDS = [
  rf.integer('reopen_window_days', { min: 0 }),
  rf.lookup('business_hours_calendar_id', 'businessHours'),
  rf.integer('sla_warning_percent', { min: 0 }),
  rf.bool('csat_enabled'),
];

const MAILBOX_FIELDS = [
  req(rf.text('name')),
  req(rf.text('email_address')),
  req(rf.text('imap_host')),
  rf.select('imap_port', ['993', '143']),
  req(rf.text('imap_username')),
  req(rf.text('imap_password', { secret: true })),
  rf.uuid('default_team_id'),
  rf.uuid('default_category_id'),
  rf.select('default_priority', PRIORITIES),
  rf.bool('is_active', { defaultValue: true }),
];

/** Routing rules, business hours, helpdesk settings, support mailboxes and notification preferences. */
export const HELPDESK_AUTOMATION_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.HELPDESK_AUTOMATION',
  tabs: [
    {
      id: 'routing-rules',
      titleKey: 'RES.P.routing_rules',
      module: 'service',
      list: {
        path: '/esm/helpdesk/routing-rules',
        columns: [...cols('name', 'position'), col('is_active', 'bool'), col('stop_processing', 'bool')],
      },
      create: act('POST', 'RES.A.new_routing_rule', '/esm/helpdesk/routing-rules', { fields: ROUTING_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/helpdesk/routing-rules/{id}', { prefill: true, fields: ROUTING_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/helpdesk/routing-rules/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'business-hours',
      titleKey: 'RES.P.business_hours',
      module: 'service',
      list: {
        path: '/esm/helpdesk/business-hours',
        columns: [...cols('code', 'name', 'timezone'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.new_business_hours', '/esm/helpdesk/business-hours', { fields: BUSINESS_HOURS_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/helpdesk/business-hours/{id}', { prefill: true, fields: BUSINESS_HOURS_FIELDS }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/helpdesk/business-hours/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'settings',
      titleKey: 'RES.P.helpdesk_settings',
      module: 'service',
      list: { path: '/esm/helpdesk/settings', report: true, columns: [] },
      toolbar: [
        act('PUT', 'RES.A.edit_settings', '/esm/helpdesk/settings', { prefill: true, fields: SETTINGS_FIELDS }),
        act('PUT', 'RES.A.team_assignment', '/esm/helpdesk/teams/{id}/assignment', {
          fields: [
            req(rf.uuid('id', { labelKey: 'RES.F.team_id' })),
            req(rf.select('assignment_strategy', STRATEGIES)),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'priority-matrix',
      titleKey: 'RES.P.priority_matrix',
      module: 'service',
      list: { path: '/esm/helpdesk/priority-matrix', report: true, columns: [] },
    },
    {
      id: 'mailboxes',
      titleKey: 'RES.P.support_mailboxes',
      module: 'service',
      list: {
        path: '/esm/helpdesk/mailboxes',
        columns: [
          ...cols('name', 'email_address', 'imap_host'),
          col('is_active', 'bool'),
          col('last_polled_at', 'datetime'),
          ...cols('last_error'),
        ],
      },
      create: act('POST', 'RES.A.new_mailbox', '/esm/helpdesk/mailboxes', { fields: MAILBOX_FIELDS }),
      rowActions: [
        act('PATCH', 'RES.ACTION.EDIT', '/esm/helpdesk/mailboxes/{id}', {
          prefill: true,
          fields: MAILBOX_FIELDS.map((field) => ({ ...field, required: false })),
        }),
        act('POST', 'RES.A.poll_now', '/esm/helpdesk/mailboxes/{id}/poll', { confirm: true }),
        act('GET', 'RES.A.mailbox_messages', '/esm/helpdesk/mailboxes/{id}/messages', { showResult: true }),
        act('DELETE', 'RES.ACTION.DELETE', '/esm/helpdesk/mailboxes/{id}', { confirm: true, danger: true }),
      ],
    },
    {
      id: 'notification-preferences',
      titleKey: 'RES.P.helpdesk_notification_preferences',
      module: 'service',
      list: { path: '/esm/helpdesk/notification-preferences', report: true, columns: [] },
      toolbar: [
        act('PUT', 'RES.A.edit_preferences', '/esm/helpdesk/notification-preferences', {
          fields: [
            req(
              rf.lines(
                'preferences',
                [req(rf.select('event', NOTIFICATION_EVENTS)), rf.bool('mail'), rf.bool('in_app')],
                { required: true },
              ),
            ),
          ],
          showResult: true,
        }),
      ],
    },
  ],
};
