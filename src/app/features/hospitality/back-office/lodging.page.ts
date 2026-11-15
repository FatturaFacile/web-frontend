import { act, col, cols, ResourcePageConfig, rf, req, tagCol, whenIn } from '@shared';

const MEAL_PLANS = ['room_only', 'bed_breakfast', 'half_board', 'full_board'] as const;
const FOLIO_CATEGORIES = ['room', 'city_tax', 'extra', 'restaurant', 'other'] as const;
const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'other'] as const;
const TASK_TYPES = ['checkout_clean', 'daily', 'inspection'] as const;
const HOUSEKEEPING_STATUSES = ['clean', 'dirty', 'inspected'] as const;
const ACCOMMODATION_STATUSES = ['available', 'out_of_service'] as const;

/** Lodging: stays with check-in, folio and check-out, housekeeping board, rooms, room types, rate plans and availability. */
export const HOSPITALITY_LODGING_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.HOSPITALITY_LODGING',
  tabs: [
    {
      id: 'stays',
      titleKey: 'RES.P.lodging_stays',
      module: 'hospitality',
      list: {
        path: '/hospitality/stays',
        filters: [rf.select('status', ['booked', 'checked_in', 'checked_out', 'cancelled', 'no_show']), rf.date('date')],
        columns: [...cols('number', 'guest_name', 'adults', 'room_total', 'folio_balance'), col('check_in_date', 'date'), col('check_out_date', 'date'), tagCol('status')],
      },
      detailPath: '/hospitality/stays/{id}',
      create: act('POST', 'RES.A.book_stay', '/hospitality/stays', {
        fields: [
          req(rf.text('guest_name', { maxLength: 160 })),
          rf.text('guest_email', { maxLength: 190 }),
          req(rf.uuid('room_type_id')),
          rf.uuid('rate_plan_id'),
          req(rf.date('check_in_date')),
          req(rf.date('check_out_date', { notBefore: 'check_in_date', strictlyAfter: true })),
          req(rf.integer('adults', { min: 1, max: 20, defaultValue: 2 })),
          rf.textarea('notes', { maxLength: 2000 }),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.check_in', '/hospitality/stays/{id}/check-in', {
          fields: [rf.uuid('accommodation_id'), rf.decimal('city_tax_per_person_night', { min: 0, max: 1000 })],
          visible: whenIn('status', 'booked'),
          showResult: true,
        }),
        act('POST', 'RES.A.folio_charge', '/hospitality/stays/{id}/charges', {
          fields: [req(rf.select('category', FOLIO_CATEGORIES)), req(rf.text('description', { maxLength: 190 })), rf.decimal('quantity', { positive: true }), req(rf.decimal('unit_amount', { min: 0 })), rf.date('posted_on')],
          visible: whenIn('status', 'booked', 'checked_in'),
          showResult: true,
        }),
        act('POST', 'RES.A.folio_payment', '/hospitality/stays/{id}/payments', {
          fields: [req(rf.decimal('amount', { positive: true })), req(rf.select('payment_method', PAYMENT_METHODS)), rf.text('description', { maxLength: 190 })],
          visible: whenIn('status', 'booked', 'checked_in'),
          showResult: true,
        }),
        act('POST', 'RES.A.check_out', '/hospitality/stays/{id}/check-out', { confirm: true, visible: whenIn('status', 'checked_in'), showResult: true }),
        act('GET', 'RES.A.folio_statement', '/hospitality/stays/{id}/folio-statement', { showResult: true }),
        act('POST', 'RES.A.invoice_folio', '/hospitality/stays/{id}/invoice', {
          fields: [
            req(rf.lookup('contact_id', 'contacts')),
            req(rf.decimal('tax_rate', { min: 0, max: 100 })),
            rf.json('category_tax_rates', { jsonCheck: (parsed) => typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) }),
            rf.date('date'),
          ],
          visible: whenIn('status', 'checked_out'),
          showResult: true,
        }),
        act('POST', 'RES.A.cancel_stay', '/hospitality/stays/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'booked') }),
        act('POST', 'RES.A.no_show', '/hospitality/stays/{id}/no-show', { confirm: true, danger: true, visible: whenIn('status', 'booked') }),
      ],
    },
    {
      id: 'group-blocks',
      titleKey: 'RES.P.lodging_group_blocks',
      module: 'hospitality',
      list: {
        path: '/hospitality/group-blocks',
        filters: [rf.select('status', ['open', 'released', 'cancelled'])],
        columns: [...cols('number', 'name', 'organizer'), col('check_in_date', 'date'), col('check_out_date', 'date'), col('release_date', 'date'), tagCol('status')],
      },
      detailPath: '/hospitality/group-blocks/{id}',
      create: act('POST', 'RES.A.new_group_block', '/hospitality/group-blocks', {
        fields: [
          req(rf.text('name', { maxLength: 160 })),
          rf.text('organizer', { maxLength: 160 }),
          rf.lookup('contact_id', 'contacts'),
          req(rf.date('check_in_date')),
          req(rf.date('check_out_date', { notBefore: 'check_in_date', strictlyAfter: true })),
          req(rf.date('release_date')),
          rf.textarea('notes', { maxLength: 2000 }),
          rf.lines('rooms', [req(rf.uuid('room_type_id')), req(rf.integer('rooms_blocked', { min: 1, max: 500 })), rf.decimal('nightly_rate', { min: 0 })], { required: true }),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.pick_up_group_stay', '/hospitality/group-blocks/{id}/stays', {
          fields: [
            req(rf.text('guest_name', { maxLength: 160 })),
            rf.text('guest_email', { maxLength: 190 }),
            req(rf.uuid('room_type_id')),
            req(rf.integer('adults', { min: 1, max: 20, defaultValue: 2 })),
            rf.date('check_in_date'),
            rf.date('check_out_date', { notBefore: 'check_in_date', strictlyAfter: true }),
          ],
          visible: whenIn('status', 'open'),
          showResult: true,
        }),
        act('PUT', 'RES.A.edit_group_block', '/hospitality/group-blocks/{id}', {
          fields: [rf.text('name', { maxLength: 160 }), rf.text('organizer', { maxLength: 160 }), rf.date('release_date'), rf.textarea('notes', { maxLength: 2000 })],
          prefill: true,
          visible: whenIn('status', 'open'),
        }),
        act('POST', 'RES.A.change_group_block_dates', '/hospitality/group-blocks/{id}/dates', {
          fields: [req(rf.date('check_in_date')), req(rf.date('check_out_date', { notBefore: 'check_in_date', strictlyAfter: true })), rf.date('release_date')],
          prefill: true,
          visible: whenIn('status', 'open'),
        }),
        act('POST', 'RES.A.release_group_block', '/hospitality/group-blocks/{id}/release', { confirm: true, visible: whenIn('status', 'open') }),
        act('POST', 'RES.A.cancel_group_block', '/hospitality/group-blocks/{id}/cancel', { confirm: true, danger: true, visible: whenIn('status', 'open', 'released') }),
      ],
    },
    {
      id: 'housekeeping',
      titleKey: 'RES.P.lodging_housekeeping',
      module: 'hospitality',
      list: {
        path: '/hospitality/housekeeping-tasks',
        filters: [rf.select('status', ['pending', 'in_progress', 'done']), rf.date('due_on')],
        columns: [...cols('accommodation.number', 'task_type'), col('due_on', 'date'), tagCol('status'), col('completed_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_housekeeping_task', '/hospitality/housekeeping-tasks', {
        fields: [req(rf.uuid('accommodation_id')), req(rf.select('task_type', TASK_TYPES)), rf.date('due_on'), rf.uuid('assigned_to')],
      }),
      rowActions: [
        act('POST', 'RES.A.start_task', '/hospitality/housekeeping-tasks/{id}/start', { fields: [rf.uuid('assigned_to')], visible: whenIn('status', 'pending') }),
        act('POST', 'RES.A.complete_task', '/hospitality/housekeeping-tasks/{id}/complete', { visible: whenIn('status', 'pending', 'in_progress') }),
      ],
    },
    {
      id: 'accommodations',
      titleKey: 'RES.P.lodging_accommodations',
      module: 'hospitality',
      list: {
        path: '/hospitality/accommodations',
        filters: [rf.uuid('room_type_id'), rf.select('housekeeping_status', HOUSEKEEPING_STATUSES)],
        columns: [...cols('number', 'floor'), tagCol('status'), tagCol('housekeeping_status')],
      },
      create: act('POST', 'RES.A.new_accommodation', '/hospitality/accommodations', {
        fields: [req(rf.uuid('room_type_id')), req(rf.text('number', { maxLength: 20 })), rf.text('floor', { maxLength: 20 }), rf.select('status', ACCOMMODATION_STATUSES), rf.select('housekeeping_status', HOUSEKEEPING_STATUSES)],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_accommodation', '/hospitality/accommodations/{id}', {
          fields: [rf.text('number', { maxLength: 20 }), rf.text('floor', { maxLength: 20 }), rf.select('status', ACCOMMODATION_STATUSES), rf.select('housekeeping_status', HOUSEKEEPING_STATUSES)],
          prefill: true,
        }),
      ],
    },
    {
      id: 'room-types',
      titleKey: 'RES.P.lodging_room_types',
      module: 'hospitality',
      list: { path: '/hospitality/room-types', columns: [...cols('code', 'name', 'max_occupancy', 'base_rate'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_room_type', '/hospitality/room-types', {
        fields: [req(rf.text('code', { maxLength: 30 })), req(rf.text('name', { maxLength: 120 })), rf.integer('max_occupancy', { min: 1, max: 20, defaultValue: 2 }), rf.decimal('base_rate', { min: 0 }), rf.bool('is_active', { defaultValue: true })],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_room_type', '/hospitality/room-types/{id}', {
          fields: [rf.text('code', { maxLength: 30 }), rf.text('name', { maxLength: 120 }), rf.integer('max_occupancy', { min: 1, max: 20 }), rf.decimal('base_rate', { min: 0 }), rf.bool('is_active')],
          prefill: true,
        }),
      ],
    },
    {
      id: 'rate-plans',
      titleKey: 'RES.P.lodging_rate_plans',
      module: 'hospitality',
      list: { path: '/hospitality/rate-plans', columns: [...cols('code', 'name', 'meal_plan', 'nightly_rate', 'min_stay', 'priority'), col('valid_from', 'date'), col('valid_to', 'date'), col('is_active', 'bool')] },
      create: act('POST', 'RES.A.new_rate_plan', '/hospitality/rate-plans', {
        fields: [
          req(rf.text('code', { maxLength: 30 })),
          req(rf.text('name', { maxLength: 120 })),
          rf.uuid('room_type_id'),
          rf.select('meal_plan', MEAL_PLANS),
          req(rf.decimal('nightly_rate', { min: 0 })),
          req(rf.date('valid_from')),
          rf.date('valid_to', { notBefore: 'valid_from' }),
          rf.integer('min_stay', { min: 1, max: 365, defaultValue: 1 }),
          rf.integer('priority', { defaultValue: 0 }),
          rf.bool('is_active', { defaultValue: true }),
        ],
      }),
      rowActions: [
        act('PUT', 'RES.A.edit_rate_plan', '/hospitality/rate-plans/{id}', {
          fields: [rf.text('name', { maxLength: 120 }), rf.decimal('nightly_rate', { min: 0 }), rf.date('valid_from'), rf.date('valid_to', { notBefore: 'valid_from' }), rf.integer('min_stay', { min: 1, max: 365 }), rf.integer('priority'), rf.bool('is_active')],
          prefill: true,
        }),
      ],
    },
    {
      id: 'availability',
      titleKey: 'RES.P.lodging_availability',
      module: 'hospitality',
      list: {
        path: '/hospitality/stay-availability',
        report: true,
        manual: true,
        filters: [req(rf.uuid('room_type_id')), req(rf.date('from')), req(rf.date('to', { notBefore: 'from', strictlyAfter: true }))],
        columns: [],
      },
    },
    {
      id: 'quote',
      titleKey: 'RES.P.lodging_quote',
      module: 'hospitality',
      list: {
        path: '/hospitality/stay-quote',
        report: true,
        manual: true,
        filters: [req(rf.uuid('room_type_id')), req(rf.date('from')), req(rf.date('to', { notBefore: 'from', strictlyAfter: true })), rf.uuid('rate_plan_id')],
        columns: [],
      },
    },
  ],
};
