import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ComplianceIssue, CoverageCell } from '@core';
import {
  blockingIssues,
  dayCoverage,
  formatMinutes,
  issuesOfError,
  periodStart,
  problemDetail,
  shiftAnchor,
  shiftRange,
  templateLabel,
  warningIssues,
  weekdayIndex,
} from './shift-planning.util';

const blocking: ComplianceIssue = {
  severity: 'blocking_error',
  rule_code: 'IT.DAILY_REST_11H',
  translation_key: 'SHIFT_PLANNING.RULE_IT_DAILY_REST_11H',
  params: { rest_minutes: 480 },
};
const warning: ComplianceIssue = {
  severity: 'warning',
  rule_code: 'CH.SUNDAY_WORK_PERMIT',
  translation_key: 'SHIFT_PLANNING.RULE_CH_SUNDAY_WORK_PERMIT',
  params: {},
};

describe('shift planning util', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(2400)).toBe('40:00');
    expect(formatMinutes(450)).toBe('7:30');
    expect(formatMinutes(-90)).toBe('-1:30');
  });

  it('prints the shift range in the local time of the establishment', () => {
    // 22:00 Zurich in March (UTC+1) is 21:00 UTC; Rome has the same offset.
    expect(
      shiftRange({ start_at: '2026-03-02T21:00:00Z', end_at: '2026-03-03T05:00:00Z' }, 'CH'),
    ).toBe('22:00-06:00');
    expect(
      shiftRange({ start_at: '2026-07-06T04:00:00Z', end_at: '2026-07-06T12:00:00Z' }, 'IT'),
    ).toBe('06:00-14:00');
  });

  it('picks the template name in the language with an english fallback', () => {
    expect(templateLabel({ it: 'Mattina', en: 'Morning' }, 'it')).toBe('Mattina');
    expect(templateLabel({ it: 'Mattina', en: 'Morning' }, 'de')).toBe('Morning');
  });

  it('splits findings by severity', () => {
    expect(blockingIssues([blocking, warning])).toEqual([blocking]);
    expect(warningIssues([blocking, warning])).toEqual([warning]);
  });

  it('reads the findings and the detail of a 422 problem', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { title: 'x', detail: 'Rule broken', status: 422, invalid_params: [blocking] },
    });

    expect(issuesOfError(error)).toEqual([blocking]);
    expect(problemDetail(error)).toBe('Rule broken');
    expect(issuesOfError(new Error('boom'))).toEqual([]);
    expect(
      problemDetail(new HttpErrorResponse({ status: 500, error: { message: 'Server' } })),
    ).toBe('Server');
  });

  it('finds the worst coverage level of a day', () => {
    const cells: CoverageCell[] = [
      {
        date: '2026-03-02',
        shift_template_id: 'a',
        assigned: 2,
        open: 0,
        coverage_ratio: 1,
        level: 'ok',
      },
      {
        date: '2026-03-02',
        shift_template_id: 'b',
        assigned: 1,
        open: 2,
        coverage_ratio: 0.33,
        level: 'critical',
      },
      {
        date: '2026-03-03',
        shift_template_id: 'a',
        assigned: 1,
        open: 1,
        coverage_ratio: 0.5,
        level: 'low',
      },
    ];

    expect(dayCoverage(cells, '2026-03-02')).toEqual({ level: 'critical', open: 2 });
    expect(dayCoverage(cells, '2026-03-03')).toEqual({ level: 'low', open: 1 });
    expect(dayCoverage(cells, '2026-03-04')).toEqual({ level: 'ok', open: 0 });
  });

  it('computes the weekday, the start of the period and the navigation of the view', () => {
    expect(weekdayIndex('2026-03-02')).toBe(0);
    expect(weekdayIndex('2026-03-08')).toBe(6);
    expect(periodStart('2026-03-05', 'weekly')).toBe('2026-03-02');
    expect(periodStart('2026-03-05', 'monthly')).toBe('2026-03-01');
    expect(shiftAnchor('2026-03-02', 'weekly', 1)).toBe('2026-03-09');
    expect(shiftAnchor('2026-03-31', 'monthly', 1)).toBe('2026-04-01');
    expect(shiftAnchor('2026-01-15', 'monthly', -1)).toBe('2025-12-01');
  });
});
