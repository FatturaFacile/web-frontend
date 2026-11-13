import { act, col, cols, ResourcePageConfig, rf, req, tagCol } from '@shared';

const WEEKLY_PLAN_TEMPLATE = '{"mon":{"from":"08:00","to":"17:00","meals":["lunch"]}}';
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'];
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Mirrors the `days` rules of the weekly plan: weekday keys (at least one), each with HH:mm `from`/`to` and known meals. */
function isValidWeeklyPlanDays(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return false;
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  return (
    entries.length > 0 &&
    entries.every(([weekday, day]) => {
      if (!WEEKDAYS.includes(weekday) || typeof day !== 'object' || day === null) {
        return false;
      }
      const { from, to, meals } = day as Record<string, unknown>;
      return (
        typeof from === 'string' &&
        TIME_OF_DAY.test(from) &&
        typeof to === 'string' &&
        TIME_OF_DAY.test(to) &&
        (meals === undefined || (Array.isArray(meals) && meals.every((m) => typeof m === 'string' && MEALS.includes(m))))
      );
    })
  );
}

const SUBSIDY_PARAMETERS_TEMPLATE = '{"amount_per_day":"0.00"}';

/** Meals, activity enrolments, family messages, weekly plans, fee assignments, subsidy rules and documents. */
export const CHILDCARE_CARE_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.CHILDCARE_CARE',
  tabs: [
    {
      id: 'meals',
      titleKey: 'RES.P.childcare_meals',
      module: 'childcare',
      list: { path: '/childcare/meals', report: true, manual: true, filters: [req(rf.date('date'))], columns: [] },
    },
    {
      id: 'children',
      titleKey: 'RES.P.childcare_children',
      module: 'childcare',
      list: {
        path: '/childcare/children',
        filters: [rf.text('search'), rf.text('status')],
        columns: [...cols('reference_code', 'first_name', 'last_name'), tagCol('status'), col('enrolled_on', 'date')],
      },
      rowActions: [
        act('GET', 'RES.A.view_messages', '/childcare/children/{id}/messages', { showResult: true }),
        act('POST', 'RES.A.send_message', '/childcare/children/{id}/messages', { fields: [req(rf.textarea('body', { maxLength: 5000 }))] }),
        act('POST', 'RES.A.set_weekly_plan', '/childcare/children/{id}/weekly-plans', {
          fields: [
            req(rf.date('valid_from')),
            rf.date('valid_to', { notBefore: 'valid_from' }),
            req(rf.json('days', { defaultValue: WEEKLY_PLAN_TEMPLATE, jsonCheck: isValidWeeklyPlanDays })),
          ],
        }),
        act('POST', 'RES.A.assign_fee_plan', '/childcare/children/{id}/fees', {
          fields: [req(rf.uuid('fee_plan_id')), req(rf.date('valid_from')), rf.date('valid_to', { notBefore: 'valid_from' })],
        }),
        act('GET', 'RES.A.view_documents', '/childcare/children/{id}/documents', { showResult: true }),
      ],
      toolbar: [
        act('GET', 'RES.A.download_document', '/childcare/documents/{id}/download', {
          fields: [req(rf.uuid('id', { labelKey: 'RES.F.document_id' }))],
          download: true,
        }),
      ],
    },
    {
      id: 'activities',
      titleKey: 'RES.P.childcare_activities',
      module: 'childcare',
      list: { path: '/childcare/activities', columns: cols('name', 'weekday', 'starts_at', 'ends_at', 'capacity', 'monthly_fee') },
      rowActions: [
        act('POST', 'RES.A.enrol_child', '/childcare/activities/{id}/enrolments', {
          fields: [req(rf.uuid('child_id')), req(rf.date('valid_from')), rf.date('valid_to', { notBefore: 'valid_from' })],
        }),
      ],
    },
    {
      id: 'subsidy-rules',
      titleKey: 'RES.P.subsidy_rules',
      module: 'childcare',
      list: {
        path: '/childcare/subsidy-rules',
        columns: [...cols('canton', 'name', 'method'), col('valid_from', 'date'), col('valid_to', 'date'), col('verified_at', 'datetime')],
      },
      create: act('POST', 'RES.A.new_subsidy_rule', '/childcare/subsidy-rules', {
        fields: [
          req(rf.text('canton', { maxLength: 2 })),
          req(rf.text('name', { maxLength: 150 })),
          req(rf.select('method', ['fixed_per_day', 'income_brackets_per_day', 'income_brackets_percentage'])),
          req(rf.json('parameters', { defaultValue: SUBSIDY_PARAMETERS_TEMPLATE })),
          req(rf.date('valid_from')),
          rf.date('valid_to', { notBefore: 'valid_from' }),
          rf.text('source_reference', { maxLength: 500 }),
        ],
      }),
      rowActions: [
        act('POST', 'RES.A.verify_subsidy_rule', '/childcare/subsidy-rules/{id}/verify', {
          fields: [req(rf.text('source_reference', { maxLength: 500 }))],
          confirm: false,
        }),
      ],
      toolbar: [
        act('GET', 'RES.A.export_subsidies', '/childcare/billing/subsidies/export', {
          fields: [req(rf.text('period', { maxLength: 7 })), rf.text('canton', { maxLength: 2 })],
          download: true,
        }),
      ],
    },
  ],
};
