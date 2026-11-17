import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const REGISTRATION_FIELDS = [
  rf.uuid('ticket_type_id'),
  rf.uuid('contact_id'),
  req(rf.text('attendee_name', { maxLength: 190 })),
  rf.text('attendee_email', { maxLength: 190 }),
  rf.textarea('notes', { maxLength: 2000 }),
];

/** Registrations (edit attendee data, cancel) and ticket types across all events. */
export const EVENTS_ADMIN_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.EVENTS_ADMIN',
  tabs: [
    {
      id: 'registrations',
      titleKey: 'RES.P.event_registrations',
      module: 'events',
      list: {
        path: '/events/registrations',
        filters: [rf.uuid('event_id'), rf.select('status', ['confirmed', 'waitlisted', 'cancelled']), rf.text('search')],
        columns: [...cols('attendee_name', 'attendee_email', 'event.name'), tagCol('status'), col('price', 'decimal'), col('registered_at', 'datetime'), col('checked_in_at', 'datetime')],
      },
      detailPath: '/events/registrations/{id}',
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/events/registrations/{id}', {
          prefill: true,
          fields: REGISTRATION_FIELDS,
          visible: (row) => row['status'] !== 'cancelled',
        }),
        act('POST', 'RES.A.event_cancel_registration', '/events/registrations/{id}/cancel', {
          confirm: true,
          danger: true,
          visible: (row) => row['status'] !== 'cancelled',
        }),
      ],
    },
    {
      id: 'ticket-types',
      titleKey: 'RES.P.event_ticket_types',
      module: 'events',
      list: {
        path: '/events/ticket-types',
        filters: [rf.uuid('event_id')],
        columns: [...cols('name'), col('price', 'decimal'), col('quantity'), col('sold_count'), col('is_active', 'bool')],
      },
      create: act('POST', 'RES.A.event_new_ticket_type', '/events/ticket-types', {
        fields: [
          req(rf.uuid('event_id')),
          req(rf.text('name', { maxLength: 150 })),
          req(rf.decimal('price', { min: 0 })),
          rf.integer('quantity', { min: 0 }),
          rf.bool('is_active', { defaultValue: true }),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.ACTION.EDIT', '/events/ticket-types/{id}', {
          prefill: true,
          fields: [
            req(rf.text('name', { maxLength: 150 })),
            req(rf.decimal('price', { min: 0 })),
            rf.integer('quantity', { min: 0 }),
            rf.bool('is_active'),
          ],
        }),
        act('DELETE', 'RES.ACTION.DELETE', '/events/ticket-types/{id}', { confirm: true, danger: true }),
      ],
    },
  ],
};
