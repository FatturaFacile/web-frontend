import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ComplianceIssue,
  RosterMatrix,
  RosterPeriod,
  ShiftAssignment,
  ShiftPlanningApiService,
} from '@core';
import { RosterStore } from './roster.store';

const period: RosterPeriod = {
  id: 'p-1',
  location_or_department_id: null,
  production_line_id: null,
  period_type: 'weekly',
  jurisdiction: 'IT',
  start_date: '2026-03-02',
  end_date: '2026-03-08',
  status: 'draft',
  published_at: null,
  locked_at: null,
};

const shift = (id: string, overrides: Partial<ShiftAssignment> = {}): ShiftAssignment => ({
  id,
  roster_schedule_period_id: 'p-1',
  employee_id: 'e-1',
  is_open: false,
  shift_date: '2026-03-02',
  shift_template_id: 't-1',
  start_at: '2026-03-02T13:00:00Z',
  end_at: '2026-03-02T21:00:00Z',
  required_role_or_skill_id: null,
  estimated_labor_cost: '160.00',
  surcharge_breakdown: null,
  compliance_warnings: [],
  has_blocking_issue: false,
  ...overrides,
});

const matrix: RosterMatrix = {
  period,
  days: ['2026-03-02', '2026-03-03'],
  group_by: 'employee',
  rows: [
    {
      key: 'e-1',
      employee_id: 'e-1',
      employee_name: 'Anna Rossi',
      contract_minutes: 2400,
      scheduled_minutes: 480,
      utilisation_percent: 20,
      labor_cost: '160.00',
      cells: { '2026-03-02': [shift('a-1')] },
    },
  ],
  open_shifts: [shift('a-2', { employee_id: null, is_open: true })],
  coverage: [
    {
      date: '2026-03-02',
      shift_template_id: 't-1',
      assigned: 1,
      open: 1,
      coverage_ratio: 0.5,
      level: 'low',
    },
  ],
  totals: {
    labor_cost: '160.00',
    labor_cost_by_day: { '2026-03-02': '160.00' },
    scheduled_minutes: 480,
    open_shifts: 1,
    blocking_issues: 0,
    warnings: 0,
  },
};

const restViolation: ComplianceIssue = {
  severity: 'blocking_error',
  rule_code: 'IT.DAILY_REST_11H',
  translation_key: 'SHIFT_PLANNING.RULE_IT_DAILY_REST_11H',
  params: { rest_minutes: 480 },
};
const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });

describe('RosterStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof RosterStore>;

  beforeEach(() => {
    api = {
      getTemplates: vi.fn(() =>
        of(
          wrap([
            {
              id: 't-1',
              code: 'POM',
              name: { en: 'Afternoon' },
              start_time: '14:00',
              end_time: '22:00',
              break_minutes: 0,
              color_hex: '#fa8c16',
              night_surcharge_applicable: true,
              is_on_call: false,
              is_active: true,
            },
          ]),
        ),
      ),
      getPeriods: vi.fn(() => of(wrap([period]))),
      getMatrix: vi.fn(() => of(wrap(matrix))),
      getSwaps: vi.fn(() => of(wrap([]))),
      moveAssignment: vi.fn(() =>
        of(wrap({ assignment: shift('a-1'), warnings: [], estimated_labor_cost: '160.00' })),
      ),
      createAssignment: vi.fn(() =>
        of(wrap({ assignment: shift('a-3'), warnings: [], estimated_labor_cost: '160.00' })),
      ),
      publishPeriod: vi.fn(() =>
        of(wrap({ period: { ...period, status: 'published' }, assigned: 1, open: 1, warnings: 0 })),
      ),
      lockPeriod: vi.fn(() => of(wrap({ ...period, status: 'locked' }))),
      decideSwap: vi.fn(() => of(wrap({}))),
      generatePeriod: vi.fn(() =>
        of(wrap({ period, created: 5, open: 0, blocking: 0, warnings: 0 })),
      ),
    };
    TestBed.configureTestingModule({
      providers: [RosterStore, { provide: ShiftPlanningApiService, useValue: api }],
    });
    store = TestBed.inject(RosterStore);
  });

  it('loads the templates and the period of the view and derives the grid summary', async () => {
    await store.init();

    expect(store.activeTemplates()).toHaveLength(1);
    expect(store.period()?.id).toBe('p-1');
    expect(store.days()).toEqual(['2026-03-02', '2026-03-03']);
    expect(store.laborCost()).toBe(160);
    expect(store.understaffedSlots()).toBe(1);
    expect(store.coverageByDay()['2026-03-02']).toEqual({ level: 'low', open: 1 });
    expect(store.coverageByDay()['2026-03-03']).toEqual({ level: 'ok', open: 0 });
    expect(store.isEditable()).toBe(true);
  });

  it('shows an empty view when no period exists for the dates', async () => {
    api['getPeriods'].mockReturnValue(of(wrap([])));

    await store.init();

    expect(store.matrix()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('moves a shift, then reloads the matrix', async () => {
    await store.init();
    api['getMatrix'].mockClear();

    const outcome = await store.moveShift(shift('a-1'), {
      date: '2026-03-03',
      employeeId: 'e-2',
      templateId: 't-1',
    });

    expect(outcome.ok).toBe(true);
    expect(api['moveAssignment']).toHaveBeenCalledWith('a-1', {
      shift_date: '2026-03-03',
      shift_template_id: 't-1',
      employee_id: 'e-2',
      required_role_or_skill_id: null,
    });
    expect(api['getMatrix']).toHaveBeenCalledTimes(1);
  });

  it('keeps the grid and exposes the findings of a drop refused with 422', async () => {
    await store.init();
    api['moveAssignment'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              title: 'Shift Compliance Violation',
              detail: 'The shift breaks a rule',
              status: 422,
              invalid_params: [restViolation],
            },
          }),
      ),
    );
    api['getMatrix'].mockClear();

    const outcome = await store.moveShift(shift('a-1'), {
      date: '2026-03-03',
      employeeId: 'e-1',
      templateId: 't-1',
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.issues).toEqual([restViolation]);
    expect(store.lastIssues()).toEqual([restViolation]);
    expect(store.rejectedAssignmentId()).toBe('a-1');
    expect(store.error()).toBeNull();
    expect(api['getMatrix']).not.toHaveBeenCalled();
    expect(store.rows()).toHaveLength(1);

    store.clearIssues();
    expect(store.lastIssues()).toEqual([]);
  });

  it('creates a shift from a palette template in the period on screen', async () => {
    await store.init();

    await store.createShift({
      date: '2026-03-04',
      employeeId: null,
      templateId: 't-1',
      skillId: 'skill-1',
    });

    expect(api['createAssignment']).toHaveBeenCalledWith({
      roster_schedule_period_id: 'p-1',
      shift_date: '2026-03-04',
      shift_template_id: 't-1',
      employee_id: null,
      required_role_or_skill_id: 'skill-1',
    });
  });

  it('refuses to create a shift when no period is on screen', async () => {
    api['getPeriods'].mockReturnValue(of(wrap([])));
    await store.init();

    const outcome = await store.createShift({
      date: '2026-03-04',
      employeeId: null,
      templateId: 't-1',
    });

    expect(outcome.ok).toBe(false);
    expect(api['createAssignment']).not.toHaveBeenCalled();
  });

  it('locks a period that cannot be edited any more', async () => {
    await store.init();
    api['getMatrix'].mockReturnValue(
      of(wrap({ ...matrix, period: { ...period, status: 'locked' } })),
    );

    await store.lock();

    expect(store.isEditable()).toBe(false);
  });

  it('regroups the matrix by role and moves the view by a period', async () => {
    await store.init();
    api['getMatrix'].mockClear();

    await store.setGroupBy('role');
    expect(api['getMatrix']).toHaveBeenCalledWith('p-1', 'role');

    await store.navigate(1);
    expect(store.anchor()).not.toBe('');
    expect(api['getPeriods']).toHaveBeenLastCalledWith(
      'weekly',
      store.viewStart(),
      store.viewStart(),
    );
  });

  it('loads the swap inbox and decides a request', async () => {
    api['getSwaps'].mockReturnValue(of(wrap([{ id: 's-1', status: 'pending_manager_approval' }])));
    await store.init();
    await store.loadSwaps();

    expect(store.pendingSwaps()).toHaveLength(1);

    const outcome = await store.decideSwap(store.swaps()[0], { decision: 'approve' });

    expect(outcome.ok).toBe(true);
    expect(api['decideSwap']).toHaveBeenCalledWith('s-1', { decision: 'approve' });
  });

  it('generates a roster and shows its first day', async () => {
    const outcome = await store.generate({
      period_type: 'weekly',
      start_date: '2026-03-02',
      pattern: '5x2',
      employee_ids: ['e-1'],
      shift_template_ids: ['t-1'],
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.period?.id).toBe('p-1');
    expect(store.anchor()).toBe('2026-03-02');
  });
});
