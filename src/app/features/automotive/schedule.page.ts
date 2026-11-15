import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

/** Workshop schedule: planned slots of technicians and bays with conflict detection, and the service bays. */
export const AUTOMOTIVE_SCHEDULE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.AUTOMOTIVE_SCHEDULE',
  tabs: [
    {
      id: 'schedule',
      titleKey: 'RES.P.workshop_schedule',
      module: 'workshop',
      list: {
        path: '/workshop/schedule',
        filters: [req(rf.datetime('from')), req(rf.datetime('to', { notBefore: 'from', strictlyAfter: true })), rf.uuid('technician_user_id'), rf.uuid('bay_id'), rf.uuid('folder_id')],
        columns: [...cols('folder.folder_number', 'bay.code', 'technician_user_id'), col('starts_at', 'datetime'), col('ends_at', 'datetime'), tagCol('status')],
      },
      create: act('POST', 'RES.A.plan_slot', '/workshop/schedule', {
        fields: [
          req(rf.uuid('folder_id')),
          rf.uuid('technician_user_id'),
          rf.uuid('bay_id'),
          req(rf.datetime('starts_at')),
          req(rf.datetime('ends_at', { notBefore: 'starts_at', strictlyAfter: true })),
          rf.text('notes', { maxLength: 500 }),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.A.reschedule_slot', '/workshop/schedule/{id}', {
          fields: [rf.uuid('technician_user_id'), rf.uuid('bay_id'), rf.datetime('starts_at'), rf.datetime('ends_at', { notBefore: 'starts_at', strictlyAfter: true }), rf.text('notes', { maxLength: 500 })],
          visible: whenIn('status', 'planned'),
        }),
        act('POST', 'RES.A.start_slot', '/workshop/schedule/{id}/start', { visible: whenIn('status', 'planned') }),
        act('POST', 'RES.A.complete_slot', '/workshop/schedule/{id}/complete', { visible: whenIn('status', 'in_progress') }),
        act('POST', 'RES.A.cancel_slot', '/workshop/schedule/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'planned', 'in_progress') }),
      ],
    },
    {
      id: 'bays',
      titleKey: 'RES.P.workshop_bays',
      module: 'workshop',
      list: { path: '/workshop/bays', columns: [...cols('code', 'name'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_bay', '/workshop/bays', {
        fields: [req(rf.text('code', { maxLength: 30 })), req(rf.text('name', { maxLength: 120 })), rf.bool('is_active', { defaultValue: true })],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_bay', '/workshop/bays/{id}', {
          fields: [rf.text('code', { maxLength: 30 }), rf.text('name', { maxLength: 120 }), rf.bool('is_active')],
          prefill: true,
        }),
      ],
    },
  ],
};
