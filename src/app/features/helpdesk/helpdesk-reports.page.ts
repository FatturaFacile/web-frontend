import { act, col, cols, ResourcePageConfig, rf, req } from '@shared';

/** SLA, backlog and workload report, customer satisfaction and the notifications of the agent. */
export const HELPDESK_REPORTS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.HELPDESK_REPORTS',
  tabs: [
    {
      id: 'reports',
      titleKey: 'RES.P.helpdesk_reports',
      module: 'service',
      list: { path: '/esm/helpdesk/reports', report: true, filters: [rf.date('from'), rf.date('to')], columns: [] },
      toolbar: [
        act('POST', 'RES.A.record_csat', '/esm/csat', {
          fields: [
            req(rf.integer('score', { min: 1 })),
            rf.textarea('feedback'),
            rf.uuid('ticket_id'),
            rf.uuid('work_order_id'),
            rf.lookup('customer_id', 'contacts'),
            rf.text('respondent_email'),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'notifications',
      titleKey: 'RES.P.helpdesk_notifications',
      module: 'service',
      list: {
        path: '/esm/helpdesk/notifications',
        columns: [...cols('event', 'title', 'body'), col('created_at', 'datetime'), col('read_at', 'datetime')],
      },
      rowActions: [
        act('POST', 'RES.A.mark_read', '/esm/helpdesk/notifications/{id}/read', {
          visible: (row) => !row['read_at'],
        }),
      ],
    },
  ],
};
