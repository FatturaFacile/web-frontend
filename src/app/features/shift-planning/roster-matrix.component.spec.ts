import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HrApiService,
  RosterMatrix,
  RosterPeriod,
  ShiftAssignment,
  ShiftPlanningApiService,
  ShiftSwapRequest,
  ShiftTemplate,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { DropCell, RosterMatrixComponent } from './roster-matrix.component';
import { SwapApprovalDrawerComponent } from './swap-approval-drawer.component';

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

const night: ShiftAssignment = {
  id: 'a-1',
  roster_schedule_period_id: 'p-1',
  employee_id: 'e-1',
  is_open: false,
  shift_date: '2026-03-02',
  shift_template_id: 't-night',
  template: { code: 'NOT', name: { en: 'Night' }, color_hex: '#722ed1', is_on_call: false },
  start_at: '2026-03-02T21:00:00Z',
  end_at: '2026-03-03T05:00:00Z',
  required_role_or_skill_id: null,
  estimated_labor_cost: '195.00',
  surcharge_breakdown: {
    worked_minutes: 480,
    night_minutes: 420,
    sunday_minutes: 0,
    holiday_minutes: 0,
    on_call_minutes: 0,
    night_wage_surcharge_percent: 25,
    night_time_compensation_minutes: 0,
    sunday_wage_surcharge_percent: null,
    holiday_wage_surcharge_percent: null,
    on_call_wage_surcharge_percent: null,
    tags: ['night'],
  },
  compliance_warnings: [
    {
      severity: 'warning',
      rule_code: 'CONTRACT.WEEKLY_HOURS_EXCEEDED',
      translation_key: 'SHIFT_PLANNING.RULE_CONTRACT_WEEKLY_HOURS_EXCEEDED',
      params: { scheduled_hours: 48 },
    },
    {
      severity: 'blocking_error',
      rule_code: 'LEAVE.APPROVED_CONFLICT',
      translation_key: 'SHIFT_PLANNING.RULE_LEAVE_APPROVED_CONFLICT',
      params: {},
    },
  ],
  has_blocking_issue: true,
};

const open: ShiftAssignment = {
  ...night,
  id: 'a-2',
  employee_id: null,
  is_open: true,
  compliance_warnings: [],
  has_blocking_issue: false,
  shift_date: '2026-03-03',
};

const matrix: RosterMatrix = {
  period,
  days: ['2026-03-02', '2026-03-03', '2026-03-04'],
  group_by: 'employee',
  rows: [
    {
      key: 'e-1',
      employee_id: 'e-1',
      employee_name: 'Anna Rossi',
      contract_minutes: 2400,
      scheduled_minutes: 480,
      utilisation_percent: 20,
      labor_cost: '195.00',
      cells: { '2026-03-02': [night] },
    },
    {
      key: 'e-2',
      employee_id: 'e-2',
      employee_name: 'Bruno Bianchi',
      contract_minutes: 1200,
      scheduled_minutes: 0,
      utilisation_percent: 0,
      labor_cost: '0.00',
      cells: {},
    },
  ],
  open_shifts: [open],
  coverage: [
    {
      date: '2026-03-03',
      shift_template_id: 't-night',
      assigned: 0,
      open: 1,
      coverage_ratio: 0,
      level: 'critical',
    },
  ],
  totals: {
    labor_cost: '195.00',
    labor_cost_by_day: { '2026-03-02': '195.00' },
    scheduled_minutes: 480,
    open_shifts: 1,
    blocking_issues: 1,
    warnings: 1,
  },
};

const template: ShiftTemplate = {
  id: 't-night',
  code: 'NOT',
  name: { it: 'Notte', en: 'Night' },
  start_time: '22:00',
  end_time: '06:00',
  break_minutes: 0,
  color_hex: '#722ed1',
  night_surcharge_applicable: true,
  is_on_call: false,
  is_active: true,
};

const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });
const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

function dropEvent(data: unknown, target: DropCell, from = 'other'): CdkDragDrop<DropCell> {
  return {
    container: { data: target },
    previousContainer: { data: from },
    item: { data },
  } as unknown as CdkDragDrop<DropCell>;
}

describe('RosterMatrixComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getTemplates: vi.fn(() => of(wrap([template]))),
      getPeriods: vi.fn(() => of(wrap([period]))),
      getMatrix: vi.fn(() => of(wrap(matrix))),
      getSwaps: vi.fn(() => of(wrap([]))),
      moveAssignment: vi.fn(() =>
        of(wrap({ assignment: night, warnings: [], estimated_labor_cost: '195.00' })),
      ),
      createAssignment: vi.fn(() =>
        of(wrap({ assignment: night, warnings: [], estimated_labor_cost: '195.00' })),
      ),
      publishPeriod: vi.fn(() =>
        of(wrap({ period: { ...period, status: 'published' }, assigned: 1, open: 1, warnings: 1 })),
      ),
      lockPeriod: vi.fn(() => of(wrap(period))),
      decideSwap: vi.fn(() => of(wrap({}))),
      generatePeriod: vi.fn(() =>
        of(wrap({ period, created: 1, open: 0, blocking: 0, warnings: 0 })),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ShiftPlanningApiService, useValue: api },
        { provide: HrApiService, useValue: { getEmployees: vi.fn(() => of({ data: [] })) } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(RosterMatrixComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the employees with their hours, the shift cards with badges and the coverage heatmap', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Anna Rossi');
    expect(text).toContain('Bruno Bianchi');
    expect(text).toContain('8:00 / 40:00');
    expect(text).toContain('195.00');
    expect(fixture.nativeElement.querySelectorAll('.shift-card').length).toBeGreaterThanOrEqual(3);
    expect(fixture.nativeElement.querySelector('.badge-error')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.badge-warning')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.coverage-critical')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.has-blocking')).not.toBeNull();
  });

  it('moves a shift dropped on another employee and day', async () => {
    const fixture = await render();

    await fixture.componentInstance.drop(
      dropEvent(night, { rowKey: 'e-2', employeeId: 'e-2', skillId: null, date: '2026-03-04' }),
    );

    expect(api['moveAssignment']).toHaveBeenCalledWith('a-1', {
      shift_date: '2026-03-04',
      shift_template_id: 't-night',
      employee_id: 'e-2',
      required_role_or_skill_id: null,
    });
    expect(messageSpy.error).not.toHaveBeenCalled();
  });

  it('ignores a shift dropped on the cell it came from', async () => {
    const fixture = await render();
    const cell = { data: { rowKey: 'e-1', employeeId: 'e-1', skillId: null, date: '2026-03-02' } };
    const event = {
      container: cell,
      previousContainer: cell,
      item: { data: night },
    } as unknown as CdkDragDrop<DropCell>;

    await fixture.componentInstance.drop(event);

    expect(api['moveAssignment']).not.toHaveBeenCalled();
  });

  it('creates a shift for the employee when a template is dropped from the palette', async () => {
    const fixture = await render();

    await fixture.componentInstance.drop(
      dropEvent(
        template,
        { rowKey: 'e-2', employeeId: 'e-2', skillId: null, date: '2026-03-04' },
        'palette',
      ),
    );

    expect(api['createAssignment']).toHaveBeenCalledWith({
      roster_schedule_period_id: 'p-1',
      shift_date: '2026-03-04',
      shift_template_id: 't-night',
      employee_id: 'e-2',
      required_role_or_skill_id: null,
    });
  });

  it('unassigns a shift through the keyboard menu (the open row)', async () => {
    const fixture = await render();

    await fixture.componentInstance.assignTo(night, null);

    expect(api['moveAssignment']).toHaveBeenCalledWith('a-1', {
      shift_date: '2026-03-02',
      shift_template_id: 't-night',
      employee_id: null,
      required_role_or_skill_id: null,
    });
  });

  it('shows the translated rule when the API refuses a drop', async () => {
    const fixture = await render();
    api['moveAssignment'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              title: 'x',
              detail: 'Rule',
              status: 422,
              invalid_params: [
                {
                  severity: 'blocking_error',
                  rule_code: 'IT.DAILY_REST_11H',
                  translation_key: 'SHIFT_PLANNING.RULE_IT_DAILY_REST_11H',
                  params: { rest_minutes: 480, side: 'before' },
                },
              ],
            },
          }),
      ),
    );

    await fixture.componentInstance.drop(
      dropEvent(night, { rowKey: 'e-2', employeeId: 'e-2', skillId: null, date: '2026-03-04' }),
    );
    fixture.detectChanges();

    expect(translateSpy.instant).toHaveBeenCalledWith('SHIFT_PLANNING.RULE_IT_DAILY_REST_11H', {
      rest_minutes: 480,
      side: 'before',
    });
    expect(messageSpy.error).toHaveBeenCalledWith('SHIFT_PLANNING.RULE_IT_DAILY_REST_11H');
    expect(fixture.nativeElement.textContent).toContain('IT.DAILY_REST_11H');
  });

  it('publishes a draft roster and tells the planner', async () => {
    const fixture = await render();

    await fixture.componentInstance.publish();

    expect(api['publishPeriod']).toHaveBeenCalledWith('p-1');
    expect(messageSpy.success).toHaveBeenCalledWith('SHIFT_PLANNING.PUBLISHED');
  });

  it('hides the palette and cannot be edited on a locked roster', async () => {
    api['getMatrix'].mockReturnValue(
      of(wrap({ ...matrix, period: { ...period, status: 'locked' } })),
    );

    const fixture = await render();

    expect(fixture.nativeElement.querySelector('.palette')).toBeNull();
    expect(fixture.componentInstance.store.isEditable()).toBe(false);
  });

  it('offers the empty state with the generator when the period does not exist', async () => {
    api['getPeriods'].mockReturnValue(of(wrap([])));

    const fixture = await render();

    expect(fixture.nativeElement.querySelector('nz-empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.matrix')).toBeNull();
  });

  it('generates a roster from the modal and closes it', async () => {
    const fixture = await render();
    fixture.componentInstance.generateOpen.set(true);

    await fixture.componentInstance.generate({
      period_type: 'weekly',
      start_date: '2026-03-02',
      pattern: '5x2',
      employee_ids: ['e-1'],
      shift_template_ids: ['t-night'],
    });

    expect(api['generatePeriod']).toHaveBeenCalled();
    expect(fixture.componentInstance.generateOpen()).toBe(false);
  });
});

describe('SwapApprovalDrawerComponent', () => {
  const swap: ShiftSwapRequest = {
    id: 's-1',
    requester_employee_id: 'e-1',
    target_peer_employee_id: 'e-2',
    is_broadcast: false,
    shift_assignment_id: 'a-1',
    target_shift_assignment_id: null,
    status: 'pending_manager_approval',
    peer_responded_at: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    rejection_reason: null,
    assignment: night,
    created_at: null,
    compliance_impact: {
      can_approve: false,
      requester_takes_counter_shift: null,
      peer_takes_offered_shift: {
        assignment_id: 'a-1',
        current_employee_id: 'e-1',
        new_employee_id: 'e-2',
        current: { compliance_warnings: [], estimated_labor_cost: '160.00' },
        after: { compliance_warnings: night.compliance_warnings, estimated_labor_cost: '200.00' },
        has_blocking: true,
      },
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy }, provideNzIcons(icons)],
    });
  });

  it('compares the cost and the findings before and after, and blocks the approval of a blocked swap', async () => {
    const fixture = TestBed.createComponent(SwapApprovalDrawerComponent);
    fixture.componentRef.setInput('swaps', [swap, { ...swap, id: 's-2', status: 'approved' }]);
    fixture.componentRef.setInput('employeeNames', { 'e-1': 'Anna Rossi', 'e-2': 'Bruno Bianchi' });
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = document.body.textContent as string;

    expect(fixture.componentInstance.pending()).toHaveLength(1);
    expect(text).toContain('Anna Rossi → Bruno Bianchi');
    expect(text).toContain('160.00');
    expect(text).toContain('200.00');
    expect(text).toContain('SHIFT_PLANNING.CANNOT_APPROVE');
    expect(
      (
        document.body.querySelector(
          'button[nz-button][nztype="primary"]',
        ) as HTMLButtonElement | null
      )?.disabled,
    ).toBe(true);
  });

  it('emits an approval and a rejection that needs a reason', () => {
    const fixture = TestBed.createComponent(SwapApprovalDrawerComponent);
    const decided = vi.fn();
    fixture.componentInstance.decided.subscribe(decided);

    fixture.componentInstance.approve(swap);
    fixture.componentInstance.reject(swap);
    fixture.componentInstance.setReason('s-1', '  Understaffed  ');
    fixture.componentInstance.reject(swap);

    expect(decided).toHaveBeenCalledTimes(2);
    expect(decided).toHaveBeenNthCalledWith(1, { swap, decision: { decision: 'approve' } });
    expect(decided).toHaveBeenNthCalledWith(2, {
      swap,
      decision: { decision: 'reject', rejection_reason: 'Understaffed' },
    });
  });
});
