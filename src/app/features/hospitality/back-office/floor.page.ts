import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

/** Table changes (position, size, service) and the tables free for a party and interval. */
export const HOSPITALITY_FLOOR_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.HOSPITALITY_FLOOR',
  tabs: [
    {
      id: 'tables',
      titleKey: 'RES.P.floor_tables',
      module: 'hospitality',
      list: {
        path: '/hospitality/rooms/{roomId}/plan',
        report: true,
        scope: req(rf.lookup('roomId', 'hospitalityRooms')),
        columns: [],
      },
      toolbar: [
        act('PUT', 'RES.A.edit_table', '/hospitality/tables/{id}', {
          fields: [
            req(rf.uuid('id', { labelKey: 'RES.F.table_id' })),
            rf.text('name', { maxLength: 30 }),
            rf.integer('seats', { min: 1 }),
            rf.select('shape', ['square', 'round', 'rectangle']),
            rf.integer('pos_x', { min: 0 }),
            rf.integer('pos_y', { min: 0 }),
            rf.integer('width', { min: 1 }),
            rf.integer('height', { min: 1 }),
            rf.bool('is_active', { defaultValue: true }),
          ],
          showResult: true,
        }),
      ],
    },
    {
      id: 'availability',
      titleKey: 'RES.P.table_availability',
      module: 'hospitality',
      list: {
        path: '/hospitality/reservations/availability',
        report: true,
        manual: true,
        filters: [req(rf.datetime('starts_at')), req(rf.integer('duration_minutes', { min: 15 })), req(rf.integer('party_size', { min: 1 }))],
        columns: [],
      },
    },
    {
      id: 'reservations',
      titleKey: 'RES.P.table_reservations',
      module: 'hospitality',
      list: {
        path: '/hospitality/reservations',
        filters: [req(rf.date('date'))],
        columns: [...cols('guest_name', 'table_name', 'party_size'), col('starts_at', 'datetime'), col('duration_minutes'), tagCol('status')],
      },
      detailPath: '/hospitality/reservations/{id}',
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/hospitality/reservations/{id}', {
          prefill: true,
          fields: [
            rf.uuid('table_id'),
            rf.uuid('contact_id'),
            req(rf.text('guest_name', { maxLength: 150 })),
            rf.text('guest_phone', { maxLength: 40 }),
            rf.text('guest_email', { maxLength: 190 }),
            req(rf.integer('party_size', { min: 1 })),
            req(rf.datetime('starts_at')),
            req(rf.integer('duration_minutes', { min: 15 })),
            rf.textarea('notes', { maxLength: 1000 }),
          ],
          visible: (row) => ['booked', 'seated'].includes(String(row['status'])),
        }),
      ],
    },
  ],
};
