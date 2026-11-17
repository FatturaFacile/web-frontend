import { act, ResourcePageConfig, rf, req } from '@shared';

const YEAR = { min: 2000, max: 2100 };

/** Payroll tools: year-end report, dry-run simulation, pay preview, first-time setup and payslip / certificate lookup. */
export const PAYROLL_TOOLS_PAGE: ResourcePageConfig = {
  titleKey: 'RES.PAGE.PAYROLL_TOOLS',
  tabs: [
    {
      id: 'year-end',
      titleKey: 'RES.P.payroll_year_end',
      module: 'payroll',
      list: {
        path: '/payroll/reports/year-end',
        report: true,
        manual: true,
        filters: [req(rf.integer('year', YEAR))],
        columns: [],
      },
      toolbar: [
        act('POST', 'RES.A.payroll_simulate_run', '/payroll/runs/simulate', {
          fields: [req(rf.integer('year', YEAR)), req(rf.integer('month', { min: 1, max: 12 })), rf.uuid('employee_id')],
          showResult: true,
        }),
        act('POST', 'RES.A.payroll_preview_pay', '/payroll/runs/preview', {
          fields: [req(rf.uuid('employee_id')), rf.text('target_month', { maxLength: 7 })],
          showResult: true,
        }),
        act('GET', 'RES.A.payroll_view_payslip', '/payroll/payslips/{payslip_id}', {
          fields: [req(rf.uuid('payslip_id'))],
          showResult: true,
        }),
        act('GET', 'RES.A.payroll_view_certificate', '/payroll/salary-certificates/{certificate_id}', {
          fields: [req(rf.uuid('certificate_id'))],
          showResult: true,
        }),
        act('POST', 'RES.A.payroll_setup', '/payroll/setup', { confirm: true, showResult: true }),
      ],
    },
  ],
};
