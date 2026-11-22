import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { CapacityCell, CapacityHeatmap, ResourceAllocation } from '@core';
import {
  addDays,
  bandOf,
  buildCandidateAllocation,
  buildCandidateSearch,
  canSplitAt,
  certificationColor,
  daysBetween,
  effectiveBand,
  formatHours,
  formatPercent,
  isOverloadedCell,
  issueParams,
  levelColor,
  loadBarPercent,
  mondayOf,
  moveAnchor,
  needsProjectToConvert,
  overloadedRows,
  periodEndOf,
  planDrop,
  problemDetail,
  problemIssues,
  skillPayload,
  stackBars,
  utilizationStatusColor,
  utilizationStatusOf,
  windowOf,
} from './resource-planning.util';

const cell = (overrides: Partial<CapacityCell> = {}): CapacityCell => ({
  period_start: '2026-03-02',
  contractual_hours: 40,
  leave_and_holiday_hours: 0,
  net_available_hours: 40,
  hard_booked_hours: 20,
  soft_booked_hours: 0,
  billable_booked_hours: 20,
  internal_booked_hours: 0,
  load_percent: 50,
  band: 'green',
  is_overloaded: false,
  ...overrides,
});

const allocation = (overrides: Partial<ResourceAllocation> = {}): ResourceAllocation => ({
  id: 'a-1',
  project_id: 'p-1',
  project_name: 'Migration',
  wbs_node_id: null,
  wbs_node_title: null,
  employee_id: 'e-1',
  employee_name: 'Anna Rossi',
  role_id: null,
  booking_type: 'SoftTentative',
  start_date: '2026-03-09',
  end_date: '2026-03-20',
  allocated_hours_per_day: 4,
  total_allocated_hours: 40,
  is_billable: true,
  crm_opportunity_id: null,
  crm_opportunity_name: null,
  is_overloaded: false,
  peak_load_percent: 50,
  notes: null,
  ...overrides,
});

const periods = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23'];
const target = (employeeId: string, periodStart: string, periodEnd: string) => ({
  employeeId,
  periodStart,
  periodEnd,
});

describe('dates of the planner', () => {
  it('adds days and counts them across month ends', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(daysBetween('2026-03-02', '2026-03-16')).toBe(14);
    expect(daysBetween('2026-03-16', '2026-03-02')).toBe(-14);
  });

  it('finds the Monday of a week, also for a Sunday', () => {
    expect(mondayOf('2026-03-04')).toBe('2026-03-02');
    expect(mondayOf('2026-03-08')).toBe('2026-03-02');
    expect(mondayOf('2026-03-09')).toBe('2026-03-09');
  });

  it('loads eight weeks or two weeks of days and moves by four weeks or one week', () => {
    expect(windowOf('2026-03-04', 'week')).toEqual({ from: '2026-03-02', to: '2026-04-26' });
    expect(windowOf('2026-03-04', 'day')).toEqual({ from: '2026-03-04', to: '2026-03-17' });
    expect(moveAnchor('2026-03-04', 'week', 1)).toBe('2026-03-30');
    expect(moveAnchor('2026-03-04', 'day', -1)).toBe('2026-02-25');
    expect(periodEndOf('2026-03-04', 'week')).toBe('2026-03-08');
    expect(periodEndOf('2026-03-04', 'day')).toBe('2026-03-04');
  });
});

describe('saturation bands', () => {
  it('is green below 80, yellow from 80 to 100 and red above 100', () => {
    expect(bandOf(79.9, true)).toBe('green');
    expect(bandOf(80, true)).toBe('yellow');
    expect(bandOf(100, true)).toBe('yellow');
    expect(bandOf(100.01, true)).toBe('red');
    expect(bandOf(999, true)).toBe('red');
  });

  it('is grey when there is neither capacity nor a booking', () => {
    expect(bandOf(0, false)).toBe('none');
  });

  it('uses the thresholds of the answer', () => {
    expect(bandOf(70, true, { yellow: 60, red: 90 })).toBe('yellow');
    expect(bandOf(91, true, { yellow: 60, red: 90 })).toBe('red');
  });

  it('keeps the band of the API and computes one only when it is missing', () => {
    expect(effectiveBand(cell({ band: 'yellow', load_percent: 10 }))).toBe('yellow');
    expect(
      effectiveBand(cell({ band: undefined as unknown as CapacityCell['band'], load_percent: 120 })),
    ).toBe('red');
    expect(
      effectiveBand(
        cell({
          band: undefined as unknown as CapacityCell['band'],
          net_available_hours: 0,
          hard_booked_hours: 0,
          soft_booked_hours: 0,
          load_percent: 0,
        }),
      ),
    ).toBe('none');
  });

  it('flags a cell as overloaded by the flag or by the red band', () => {
    expect(isOverloadedCell(cell({ is_overloaded: true, band: 'yellow' }))).toBe(true);
    expect(isOverloadedCell(cell({ band: 'red', load_percent: 130 }))).toBe(true);
    expect(isOverloadedCell(cell())).toBe(false);
  });

  it('caps the bar of a load at 100 while the number shows the overrun', () => {
    expect(loadBarPercent(cell({ load_percent: 130 }))).toBe(100);
    expect(loadBarPercent(cell({ load_percent: 62.4 }))).toBe(62);
    expect(loadBarPercent(cell({ load_percent: -3 }))).toBe(0);
  });

  it('lists the rows with an overloaded period and their peak', () => {
    const heatmap: CapacityHeatmap = {
      from: '2026-03-02',
      to: '2026-03-15',
      granularity: 'week',
      thresholds: { yellow: 80, red: 100 },
      periods: ['2026-03-02', '2026-03-09'],
      rows: [
        {
          employee_id: 'e-1',
          employee_name: 'Anna Rossi',
          department_id: null,
          department_name: null,
          cost_center_id: null,
          weekly_contract_hours: 40,
          cells: [cell(), cell({ period_start: '2026-03-09', load_percent: 125, band: 'red', is_overloaded: true })],
        },
        {
          employee_id: 'e-2',
          employee_name: 'Bruno Bianchi',
          department_id: null,
          department_name: null,
          cost_center_id: null,
          weekly_contract_hours: 40,
          cells: [cell(), cell({ period_start: '2026-03-09' })],
        },
      ],
    };

    const rows = overloadedRows(heatmap);

    expect(rows).toHaveLength(1);
    expect(rows[0].row.employee_id).toBe('e-1');
    expect(rows[0].periods).toEqual(['2026-03-09']);
    expect(rows[0].peak).toBe(125);
    expect(overloadedRows(null)).toEqual([]);
  });

  it('formats hours and percentages without trailing zeros', () => {
    expect(formatHours(8)).toBe('8h');
    expect(formatHours(7.25)).toBe('7.3h');
    expect(formatPercent(87.5)).toBe('87.5%');
    expect(formatPercent(100)).toBe('100%');
  });
});

describe('allocation bars', () => {
  it('spans every period a booking touches', () => {
    const [bar] = stackBars([allocation()], periods, 'week');

    expect(bar.column).toBe(2);
    expect(bar.span).toBe(2);
    expect(bar.track).toBe(0);
    expect(bar.clippedStart).toBe(false);
    expect(bar.clippedEnd).toBe(false);
  });

  it('puts overlapping bookings on separate lanes and reuses a lane that is free again', () => {
    const bars = stackBars(
      [
        allocation({ id: 'a-1', start_date: '2026-03-02', end_date: '2026-03-13' }),
        allocation({ id: 'a-2', start_date: '2026-03-09', end_date: '2026-03-20' }),
        allocation({ id: 'a-3', start_date: '2026-03-23', end_date: '2026-03-27' }),
      ],
      periods,
      'week',
    );

    expect(bars.map((bar) => [bar.allocation.id, bar.track])).toEqual([
      ['a-1', 0],
      ['a-2', 1],
      ['a-3', 0],
    ]);
  });

  it('clips a booking that starts before or ends after the window and drops one outside it', () => {
    const bars = stackBars(
      [
        allocation({ id: 'wide', start_date: '2026-02-16', end_date: '2026-04-10' }),
        allocation({ id: 'outside', start_date: '2026-05-04', end_date: '2026-05-08' }),
      ],
      periods,
      'week',
    );

    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ column: 1, span: 4, clippedStart: true, clippedEnd: true });
    expect(stackBars([allocation()], [], 'week')).toEqual([]);
  });

  it('places a one day booking on its day in the day view', () => {
    const days = ['2026-03-09', '2026-03-10', '2026-03-11'];
    const [bar] = stackBars(
      [allocation({ start_date: '2026-03-10', end_date: '2026-03-10' })],
      days,
      'day',
    );

    expect(bar).toMatchObject({ column: 2, span: 1 });
  });
});

describe('planDrop', () => {
  const window = { windowStart: '2026-03-02' };

  it('shifts a booking dropped on a later week by whole weeks', () => {
    expect(
      planDrop(allocation(), 'move', target('e-1', '2026-03-23', '2026-03-29'), 'week', window),
    ).toEqual({ strategy: 'shift', shift_days: 14 });
    expect(
      planDrop(allocation(), 'move', target('e-1', '2026-03-02', '2026-03-08'), 'week', window),
    ).toEqual({ strategy: 'shift', shift_days: -7 });
  });

  it('sends the colleague with the shift when it is dropped on another row', () => {
    expect(
      planDrop(allocation(), 'move', target('e-2', '2026-03-16', '2026-03-22'), 'week', window),
    ).toEqual({ strategy: 'shift', shift_days: 7, employee_id: 'e-2' });
    expect(
      planDrop(allocation(), 'move', target('e-2', '2026-03-09', '2026-03-15'), 'week', window),
    ).toEqual({ strategy: 'shift', shift_days: 0, employee_id: 'e-2' });
  });

  it('does nothing for a drop on the same row and period', () => {
    expect(
      planDrop(allocation(), 'move', target('e-1', '2026-03-09', '2026-03-15'), 'week', window),
    ).toBeNull();
  });

  it('moves a booking clipped by the window relative to its visible edge', () => {
    const clipped = allocation({ start_date: '2026-02-16' });

    expect(
      planDrop(clipped, 'move', target('e-1', '2026-03-02', '2026-03-08'), 'week', window),
    ).toBeNull();
    expect(
      planDrop(clipped, 'move', target('e-1', '2026-03-09', '2026-03-15'), 'week', window),
    ).toEqual({ strategy: 'shift', shift_days: 7 });
  });

  it('moves by days in the day view', () => {
    const days = allocation({ start_date: '2026-03-09', end_date: '2026-03-13' });

    expect(
      planDrop(days, 'move', target('e-1', '2026-03-11', '2026-03-11'), 'day', {
        windowStart: '2026-03-09',
      }),
    ).toEqual({ strategy: 'shift', shift_days: 2 });
  });

  it('splits at the dropped period with the second part on the dropped row', () => {
    const options = { ...window, split: true };

    expect(
      planDrop(allocation(), 'move', target('e-1', '2026-03-16', '2026-03-22'), 'week', options),
    ).toEqual({ strategy: 'split', split_date: '2026-03-16' });
    expect(
      planDrop(allocation(), 'move', target('e-2', '2026-03-16', '2026-03-22'), 'week', options),
    ).toEqual({ strategy: 'split', split_date: '2026-03-16', employee_id: 'e-2' });
  });

  it('refuses a split outside the booking', () => {
    const options = { ...window, split: true };

    expect(
      planDrop(allocation(), 'move', target('e-1', '2026-03-09', '2026-03-15'), 'week', options),
    ).toBeNull();
    expect(
      planDrop(allocation(), 'move', target('e-1', '2026-03-23', '2026-03-29'), 'week', options),
    ).toBeNull();
    expect(canSplitAt(allocation(), '2026-03-10')).toBe(true);
    expect(canSplitAt(allocation(), '2026-03-09')).toBe(false);
    expect(canSplitAt(allocation(), '2026-03-20')).toBe(true);
    expect(canSplitAt(allocation(), '2026-03-21')).toBe(false);
  });

  it('resizes the end to the end of the dropped period', () => {
    expect(
      planDrop(allocation(), 'resize-end', target('e-1', '2026-03-23', '2026-03-29'), 'week', window),
    ).toEqual({ strategy: 'resize', end_date: '2026-03-29' });
    // The same week as the current end, and an end before the start, change nothing.
    expect(
      planDrop(allocation(), 'resize-end', target('e-1', '2026-03-16', '2026-03-22'), 'week', window),
    ).toBeNull();
    expect(
      planDrop(allocation(), 'resize-end', target('e-1', '2026-03-02', '2026-03-08'), 'week', window),
    ).toBeNull();
  });

  it('resizes the start to the start of the dropped period', () => {
    expect(
      planDrop(allocation(), 'resize-start', target('e-1', '2026-03-02', '2026-03-08'), 'week', window),
    ).toEqual({ strategy: 'resize', start_date: '2026-03-02' });
    expect(
      planDrop(allocation(), 'resize-start', target('e-1', '2026-03-09', '2026-03-15'), 'week', window),
    ).toBeNull();
    expect(
      planDrop(allocation(), 'resize-start', target('e-1', '2026-03-23', '2026-03-29'), 'week', window),
    ).toBeNull();
  });

  it('knows which soft bookings need a project to become hard', () => {
    expect(needsProjectToConvert(allocation({ project_id: null }))).toBe(true);
    expect(needsProjectToConvert(allocation())).toBe(false);
    expect(
      needsProjectToConvert(allocation({ project_id: null, booking_type: 'HardCommitted' })),
    ).toBe(false);
  });
});

describe('candidate search and one-click allocation', () => {
  const input = {
    startDate: '2026-03-02',
    endDate: '2026-03-13',
    hoursPerDay: 4,
    requirements: [
      { skill_id: 's-1', min_level: 3 },
      { skill_id: '', min_level: 2 },
      { skill_id: 's-2', min_level: 9 },
    ],
    requireValidCertificates: true,
    includeIneligible: false,
  };

  it('drops the empty requirements, clamps the level and leaves empty options out', () => {
    expect(buildCandidateSearch(input)).toEqual({
      start_date: '2026-03-02',
      end_date: '2026-03-13',
      allocated_hours_per_day: 4,
      requirements: [
        { skill_id: 's-1', min_level: 3 },
        { skill_id: 's-2', min_level: 5 },
      ],
      require_valid_certificates: true,
      include_ineligible: false,
    });
  });

  it('adds the project, the WBS node and the department when they are chosen', () => {
    const payload = buildCandidateSearch({
      ...input,
      projectId: 'p-1',
      wbsNodeId: 'w-1',
      departmentId: 'd-1',
    });

    expect(payload).toMatchObject({ project_id: 'p-1', wbs_node_id: 'w-1', department_id: 'd-1' });
    // A WBS node without a project would be refused by the API.
    expect(buildCandidateSearch({ ...input, wbsNodeId: 'w-1' }).wbs_node_id).toBeUndefined();
  });

  it('books a candidate with the window, the hours and the skills of the search', () => {
    const search = buildCandidateSearch(input);

    expect(
      buildCandidateAllocation({ employee_id: 'e-9' }, search, 'HardCommitted', 'p-1', 'w-1'),
    ).toEqual({
      employee_id: 'e-9',
      project_id: 'p-1',
      wbs_node_id: 'w-1',
      booking_type: 'HardCommitted',
      start_date: '2026-03-02',
      end_date: '2026-03-13',
      allocated_hours_per_day: 4,
      required_skill_ids: ['s-1', 's-2'],
    });
    expect(
      buildCandidateAllocation({ employee_id: 'e-9' }, search, 'SoftTentative', 'p-1', null)
        .wbs_node_id,
    ).toBeUndefined();
  });
});

describe('errors', () => {
  const refused = (body: unknown) => new HttpErrorResponse({ status: 422, error: body });

  it('reads the violated rules and the detail of a problem response', () => {
    const error = refused({
      detail: 'Refused',
      invalid_params: [{ code: 'overload', params: { peak: 120 } }, { code: 'no_working_days' }],
    });

    expect(problemIssues(error)).toEqual([
      { code: 'overload', params: { peak: 120 } },
      { code: 'no_working_days' },
    ]);
    expect(problemDetail(error)).toBe('Refused');
  });

  it('answers empty for anything that is not a problem response', () => {
    expect(problemIssues(new Error('boom'))).toEqual([]);
    expect(problemIssues(refused(null))).toEqual([]);
    expect(problemDetail(new Error('boom'))).toBeNull();
  });

  it('turns the params into placeholders', () => {
    expect(issueParams({ params: { peak: 120, ok: true, none: null, name: 'Anna' } })).toEqual({
      peak: 120,
      ok: 'true',
      none: '',
      name: 'Anna',
    });
    expect(issueParams({})).toEqual({});
  });
});

describe('skills and utilization helpers', () => {
  it('colours the levels and the certificate statuses', () => {
    expect(levelColor(5)).toBe('green');
    expect(levelColor(3)).toBe('blue');
    expect(levelColor(1)).toBe('default');
    expect(certificationColor('valid')).toBe('green');
    expect(certificationColor('not_required')).toBe('default');
    expect(certificationColor('expired')).toBe('red');
  });

  it('builds a skill only when the certificate code is given for a certified one', () => {
    expect(
      skillPayload({
        category: ' Safety ',
        skillName: ' Forklift ',
        requiresCertification: false,
        certificationCode: 'ignored',
      }),
    ).toEqual({
      category: 'Safety',
      skill_name: 'Forklift',
      requires_certification: false,
      certification_code: null,
    });
    expect(
      skillPayload({
        category: 'Safety',
        skillName: 'Forklift',
        requiresCertification: true,
        certificationCode: '',
      }),
    ).toBeNull();
    expect(
      skillPayload({
        category: 'Safety',
        skillName: 'Forklift',
        requiresCertification: true,
        certificationCode: 'FORK',
      })?.certification_code,
    ).toBe('FORK');
    expect(
      skillPayload({
        category: '',
        skillName: 'Forklift',
        requiresCertification: false,
        certificationCode: '',
      }),
    ).toBeNull();
  });

  it('is on target within five points of the target', () => {
    expect(utilizationStatusOf(0)).toBe('on_target');
    expect(utilizationStatusOf(-5)).toBe('on_target');
    expect(utilizationStatusOf(5)).toBe('on_target');
    expect(utilizationStatusOf(-5.1)).toBe('below_target');
    expect(utilizationStatusOf(5.1)).toBe('above_target');
    expect(utilizationStatusColor('on_target')).toBe('green');
    expect(utilizationStatusColor('below_target')).toBe('orange');
    expect(utilizationStatusColor('above_target')).toBe('blue');
  });
});
