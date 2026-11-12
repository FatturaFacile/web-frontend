import { act, col, cols, ResourcePageConfig, ResourcePanelConfig, rf, req, tagCol, whenIn } from '@shared';

const MODULE = 'associations';

const ATTENDANCE_ENTRIES = rf.lines(
  'entries',
  [req(rf.uuid('member_id')), req(rf.select('status', ['present', 'absent']))],
  { required: true },
);

const ATTENDANCE_FIELDS = [req(rf.date('date')), ATTENDANCE_ENTRIES];

/** Courses and events: calendar, schedules, suspensions, instructors, attendance and lesson booking. */
const COURSES_PANEL: ResourcePanelConfig = {
  id: 'courses',
  titleKey: 'RES.P.assoc_courses',
  module: MODULE,
  detailPath: '/associations/courses/{id}',
  list: {
    path: '/associations/courses',
    columns: [...cols('code', 'title'), tagCol('kind'), tagCol('status'), col('starts_on', 'date'), col('ends_on', 'date'), col('capacity')],
  },
  toolbar: [
    act('DELETE', 'RES.A.remove_schedule', '/associations/course-schedules/{schedule_id}', {
      fields: [req(rf.uuid('schedule_id'))],
      danger: true,
    }),
    act('DELETE', 'RES.A.remove_suspension', '/associations/course-suspensions/{suspension_id}', {
      fields: [req(rf.uuid('suspension_id'))],
      danger: true,
    }),
    act('DELETE', 'RES.A.remove_instructor', '/associations/course-instructors/{instructor_id}', {
      fields: [req(rf.uuid('instructor_id'))],
      danger: true,
    }),
    act('POST', 'RES.A.withdraw_enrolment', '/associations/course-enrolments/{enrolment_id}/withdraw', {
      fields: [req(rf.uuid('enrolment_id'))],
      danger: true,
    }),
  ],
  rowActions: [
    act('GET', 'RES.A.calendar', '/associations/courses/{id}/calendar', { showResult: true }),
    act('POST', 'RES.A.add_schedule', '/associations/courses/{id}/schedules', {
      fields: [
        req(rf.select('pattern', ['daily', 'weekday', 'date'])),
        rf.integer('weekday', { min: 1 }),
        rf.date('on_date'),
        req(rf.text('starts_at')),
        req(rf.text('ends_at')),
        rf.uuid('resource_id'),
      ],
    }),
    act('POST', 'RES.A.add_suspension', '/associations/courses/{id}/suspensions', {
      fields: [req(rf.date('starts_on')), req(rf.date('ends_on', { notBefore: 'starts_on' })), rf.text('reason', { maxLength: 500 })],
    }),
    act('POST', 'RES.A.add_instructor', '/associations/courses/{id}/instructors', { fields: [req(rf.uuid('member_id'))] }),
    act('GET', 'RES.A.attendance', '/associations/courses/{id}/attendance', { showResult: true }),
    act('POST', 'RES.A.record_attendance', '/associations/courses/{id}/attendance', {
      fields: ATTENDANCE_FIELDS,
      showResult: true,
    }),
    act('POST', 'RES.A.book_lessons', '/associations/courses/{id}/book-lessons', {
      fields: [req(rf.datetime('from')), req(rf.datetime('to', { notBefore: 'from' }))],
      showResult: true,
    }),
    act('POST', 'RES.A.add_ticket_type', '/associations/courses/{id}/ticket-types', {
      fields: [req(rf.text('name', { maxLength: 255 })), rf.decimal('price'), rf.integer('quantity', { min: 0 })],
      visible: whenIn('kind', 'event', 'big_event'),
    }),
    act('GET', 'RES.A.registrations', '/associations/courses/{id}/registrations', {
      showResult: true,
      visible: whenIn('kind', 'event', 'big_event'),
    }),
    act('POST', 'RES.A.check_in', '/associations/courses/{id}/check-in', {
      fields: [req(rf.text('ticket_code', { maxLength: 40 }))],
      showResult: true,
      visible: whenIn('kind', 'event', 'big_event'),
    }),
  ],
};

/** Registrations to the tickets of an event. */
const EVENTS_PANEL: ResourcePanelConfig = {
  id: 'events',
  titleKey: 'RES.P.assoc_events',
  module: MODULE,
  list: {
    path: '/associations/courses/{course_id}/registrations',
    scope: rf.uuid('course_id'),
    columns: [...cols('member_id', 'ticket_code'), tagCol('status'), col('waitlist_position'), col('checked_in_at', 'datetime')],
  },
  create: act('POST', 'RES.A.register_ticket', '/associations/ticket-types/{ticket_type_id}/registrations', {
    fields: [req(rf.uuid('ticket_type_id')), req(rf.uuid('member_id'))],
  }),
  rowActions: [
    act('POST', 'RES.ACTION.CANCEL', '/associations/event-registrations/{id}/cancel', {
      confirm: true,
      danger: true,
      visible: whenIn('status', 'confirmed', 'waitlisted'),
    }),
  ],
};

/** Bookings of rooms and resources. */
const BOOKINGS_PANEL: ResourcePanelConfig = {
  id: 'bookings',
  titleKey: 'RES.P.assoc_bookings',
  module: MODULE,
  list: {
    path: '/associations/bookings',
    columns: [...cols('title', 'resource_id'), col('starts_at', 'datetime'), col('ends_at', 'datetime'), tagCol('status')],
  },
  create: act('POST', 'RES.A.new_booking', '/associations/bookings', {
    fields: [
      req(rf.uuid('resource_id')),
      req(rf.datetime('starts_at')),
      req(rf.datetime('ends_at', { notBefore: 'starts_at', strictlyAfter: true })),
      rf.uuid('member_id'),
      rf.uuid('course_id'),
      rf.text('title', { maxLength: 255 }),
    ],
  }),
  rowActions: [
    act('POST', 'RES.ACTION.CANCEL', '/associations/bookings/{id}/cancel', {
      confirm: true,
      danger: true,
      visible: whenIn('status', 'confirmed'),
    }),
  ],
};

export const ASSOC_COURSES_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.ASSOC_COURSES',
  tabs: [COURSES_PANEL, EVENTS_PANEL, BOOKINGS_PANEL],
};
