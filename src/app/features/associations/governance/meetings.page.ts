import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol, whenIn } from '@shared';

const BODIES = ['assembly', 'board', 'other'] as const;
const CHANNELS = ['email', 'sms', 'whatsapp', 'telegram'] as const;
const DELIVERY_MODES = ['all', 'unreached', 'selected'] as const;
const ATTENDANCE = ['invited', 'present', 'online', 'absent'] as const;
const MAJORITY_RULES = ['simple', 'absolute', 'qualified'] as const;

const MEETING_FIELDS = [
  req(rf.select('body', BODIES)),
  rf.text('body_name', { maxLength: 255 }),
  req(rf.text('title', { maxLength: 255 })),
  rf.textarea('subject'),
  rf.datetime('scheduled_at'),
  rf.datetime('second_call_at'),
  rf.text('location', { maxLength: 255 }),
  rf.text('online_url', { maxLength: 500 }),
  rf.decimal('first_call_quorum_percent'),
  rf.decimal('second_call_quorum_percent'),
  rf.bool('proxies_allowed'),
];

const DELIVERY_FIELDS = [req(rf.select('channel', CHANNELS)), req(rf.select('mode', DELIVERY_MODES)), rf.tags('member_ids')];

const MEETING_COLUMNS = [...cols('title'), tagCol('body'), tagCol('status'), col('scheduled_at', 'datetime'), ...cols('location', 'id')];

type TabExtras = Pick<ResourcePanelConfig, 'detailPath' | 'create' | 'rowActions' | 'toolbar'>;

/** Every tab lists the meetings and offers the actions of one phase of their life. */
const meetingsTab = (id: string, extra: TabExtras): ResourcePanelConfig => ({
  id,
  titleKey: `RES.P.assoc_${id}`,
  module: 'associations',
  list: {
    path: '/associations/meetings',
    filters: [rf.select('body', BODIES), rf.select('status', ['draft', 'convened', 'held', 'closed', 'cancelled'])],
    columns: MEETING_COLUMNS,
  },
  ...extra,
});

const BALLOT_ID = [req(rf.uuid('id', { labelKey: 'RES.F.ballot_id' }))];
const MINUTES_ID = [req(rf.uuid('id', { labelKey: 'RES.F.minutes_id' }))];

/** General meetings and boards: convocation, attendance, ballots and minutes. */
export const ASSOCIATIONS_MEETINGS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_MEETINGS',
  tabs: [
    meetingsTab('meetings', {
      detailPath: '/associations/meetings/{id}',
      create: act('POST', 'RES.A.assoc_new_meeting', '/associations/meetings', { fields: MEETING_FIELDS }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/associations/meetings/{id}', {
          prefill: true,
          fields: MEETING_FIELDS,
          visible: whenIn('status', 'draft', 'convened'),
        }),
        act('POST', 'RES.A.assoc_hold_meeting', '/associations/meetings/{id}/hold', {
          fields: [req(rf.select('call', ['first', 'second']))],
          visible: whenIn('status', 'convened'),
        }),
        act('POST', 'RES.A.assoc_close_meeting', '/associations/meetings/{id}/close', {
          confirm: true,
          visible: whenIn('status', 'held'),
        }),
        act('POST', 'RES.A.assoc_cancel_meeting', '/associations/meetings/{id}/cancel', {
          confirm: true,
          danger: true,
          visible: whenIn('status', 'draft', 'convened'),
        }),
        act('DELETE', 'RES.ACTION.DELETE', '/associations/meetings/{id}', {
          confirm: true,
          danger: true,
          visible: whenIn('status', 'draft'),
        }),
      ],
    }),
    meetingsTab('convocation', {
      detailPath: '/associations/meetings/{id}',
      rowActions: [
        act('POST', 'RES.A.assoc_add_agenda_item', '/associations/meetings/{id}/agenda-items', {
          fields: [req(rf.text('title', { maxLength: 255 })), rf.textarea('description')],
          showResult: true,
        }),
        act('POST', 'RES.A.assoc_add_attachment', '/associations/meetings/{id}/attachments', {
          fields: [req(rf.file('file'))],
        }),
        act('POST', 'RES.A.assoc_add_participants', '/associations/meetings/{id}/participants', {
          fields: [
            req(rf.select('source', ['members', 'board', 'registry_type', 'selected'])),
            rf.tags('member_ids'),
            rf.uuid('registry_type_id'),
            rf.tags('social_role_ids'),
            rf.bool('eligible', { defaultValue: true }),
          ],
          showResult: true,
        }),
        act('POST', 'RES.A.assoc_send_notice', '/associations/meetings/{id}/notices', {
          fields: DELIVERY_FIELDS,
          showResult: true,
          visible: whenIn('status', 'draft', 'convened'),
        }),
        act('GET', 'RES.A.assoc_deliveries', '/associations/meetings/{id}/deliveries', { showResult: true }),
        act('GET', 'RES.A.assoc_letter', '/associations/meetings/{id}/letter', { download: true }),
      ],
    }),
    meetingsTab('attendance', {
      detailPath: '/associations/meetings/{id}',
      rowActions: [
        act('POST', 'RES.A.assoc_record_attendance', '/associations/meetings/{id}/attendance', {
          fields: [
            req(rf.lines('entries', [req(rf.uuid('participant_id')), req(rf.select('attendance', ATTENDANCE))], { required: true })),
          ],
          showResult: true,
        }),
        act('POST', 'RES.A.assoc_grant_proxy', '/associations/meetings/{id}/proxies', {
          fields: [req(rf.uuid('grantor_participant_id')), req(rf.uuid('holder_participant_id'))],
          showResult: true,
        }),
        act('GET', 'RES.A.assoc_quorum', '/associations/meetings/{id}/quorum', { showResult: true }),
      ],
    }),
    meetingsTab('ballots', {
      rowActions: [
        act('POST', 'RES.A.assoc_new_ballot', '/associations/meetings/{id}/ballots', {
          fields: [
            req(rf.text('question', { maxLength: 500 })),
            rf.tags('options'),
            rf.bool('is_secret'),
            rf.select('majority_rule', MAJORITY_RULES),
            rf.decimal('qualified_percent'),
            rf.uuid('agenda_item_id'),
          ],
          showResult: true,
        }),
      ],
      toolbar: [
        act('GET', 'RES.A.assoc_view_ballot', '/associations/ballots/{id}', { fields: BALLOT_ID, showResult: true }),
        act('POST', 'RES.A.assoc_open_ballot', '/associations/ballots/{id}/open', { fields: BALLOT_ID, showResult: true }),
        act('POST', 'RES.A.assoc_close_ballot', '/associations/ballots/{id}/close', { fields: BALLOT_ID, showResult: true }),
        act('POST', 'RES.A.assoc_record_vote', '/associations/ballots/{id}/votes', {
          fields: [...BALLOT_ID, req(rf.text('choice', { maxLength: 100 })), rf.uuid('participant_id'), rf.text('on_behalf_of')],
          showResult: true,
        }),
      ],
    }),
    meetingsTab('minutes', {
      rowActions: [act('POST', 'RES.A.assoc_new_minutes', '/associations/meetings/{id}/minutes', { confirm: true, showResult: true })],
      toolbar: [
        act('GET', 'RES.A.assoc_view_minutes', '/associations/minutes/{id}', { fields: MINUTES_ID, showResult: true }),
        act('PUT', 'RES.A.assoc_edit_minutes', '/associations/minutes/{id}', {
          fields: [...MINUTES_ID, rf.text('title', { maxLength: 255 }), rf.textarea('body')],
          showResult: true,
        }),
        act('POST', 'RES.A.assoc_approve_minutes', '/associations/minutes/{id}/approve', { fields: MINUTES_ID, showResult: true }),
        act('GET', 'RES.A.assoc_minutes_pdf', '/associations/minutes/{id}/pdf', { fields: MINUTES_ID, download: true }),
        act('POST', 'RES.A.assoc_distribute_minutes', '/associations/minutes/{id}/distribute', {
          fields: [...MINUTES_ID, ...DELIVERY_FIELDS],
          showResult: true,
        }),
        act('GET', 'RES.A.assoc_minutes_deliveries', '/associations/minutes/{id}/deliveries', {
          fields: MINUTES_ID,
          showResult: true,
        }),
      ],
    }),
  ],
};
