import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AllocationMutationResult,
  CapacityCell,
  CapacityHeatmap,
  CapacityResource,
  ResourceAllocation,
  ResourcePlanningApiService,
} from '@core';
import { ResourcePlannerStore } from './resource-planning.store';

const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });

const cell = (period: string, load: number, overrides: Partial<CapacityCell> = {}): CapacityCell => ({
  period_start: period,
  contractual_hours: 40,
  leave_and_holiday_hours: 0,
  net_available_hours: 40,
  hard_booked_hours: (load / 100) * 40,
  soft_booked_hours: 0,
  billable_booked_hours: (load / 100) * 40,
  internal_booked_hours: 0,
  load_percent: load,
  band: load > 100 ? 'red' : load >= 80 ? 'yellow' : 'green',
  is_overloaded: load > 100,
  ...overrides,
});

const periods = ['2026-03-02', '2026-03-09', '2026-03-16'];

const heatmap: CapacityHeatmap = {
  from: '2026-03-02',
  to: '2026-03-22',
  granularity: 'week',
  thresholds: { yellow: 80, red: 100 },
  periods,
  rows: [
    {
      employee_id: 'e-1',
      employee_name: 'Anna Rossi',
      department_id: 'd-1',
      department_name: 'Engineering',
      cost_center_id: null,
      weekly_contract_hours: 40,
      cells: [cell(periods[0], 50), cell(periods[1], 125), cell(periods[2], 85)],
    },
    {
      employee_id: 'e-2',
      employee_name: 'Bruno Bianchi',
      department_id: 'd-2',
      department_name: 'Design',
      cost_center_id: null,
      weekly_contract_hours: 40,
      cells: [cell(periods[0], 0), cell(periods[1], 20), cell(periods[2], 20)],
    },
  ],
};

const allocation = (id: string, overrides: Partial<ResourceAllocation> = {}): ResourceAllocation => ({
  id,
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

const resources: CapacityResource[] = [
  {
    employee_id: 'e-1',
    full_name: 'Anna Rossi',
    department_id: 'd-1',
    department_name: 'Engineering',
    cost_center_id: 'c-1',
    cost_center_name: 'CC Eng',
    weekly_contract_hours: 40,
    fte_ratio: 1,
    hourly_cost: 60,
    country: 'CH',
    region: 'TI',
  },
  {
    employee_id: 'e-2',
    full_name: 'Bruno Bianchi',
    department_id: 'd-2',
    department_name: 'Design',
    cost_center_id: null,
    cost_center_name: null,
    weekly_contract_hours: 32,
    fte_ratio: 0.8,
    hourly_cost: 50,
    country: 'IT',
    region: null,
  },
];

const result = (overrides: Partial<AllocationMutationResult> = {}): AllocationMutationResult => ({
  allocation: allocation('a-1'),
  allocations: [allocation('a-1')],
  overload: { is_overloaded: false, peak_load_percent: 50, weeks: [] },
  warnings: [],
  ...overrides,
});

const refused = (invalidParams: unknown[]) =>
  new HttpErrorResponse({
    status: 422,
    error: { title: 'x', detail: 'Refused', status: 422, invalid_params: invalidParams },
  });

describe('ResourcePlannerStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ResourcePlannerStore>;

  beforeEach(() => {
    api = {
      getResources: vi.fn(() => of(wrap(resources))),
      getHeatmap: vi.fn(() => of(wrap(heatmap))),
      getAllocations: vi.fn(() =>
        of(
          wrap([
            allocation('a-1'),
            allocation('a-2', { employee_id: 'e-2', booking_type: 'HardCommitted' }),
          ]),
        ),
      ),
      rebalance: vi.fn(() => of(wrap(result()))),
      convertToHard: vi.fn(() => of(wrap(result()))),
      deleteAllocation: vi.fn(() => of(null)),
      createAllocation: vi.fn(() => of(wrap(result()))),
    };
    TestBed.configureTestingModule({
      providers: [ResourcePlannerStore, { provide: ResourcePlanningApiService, useValue: api }],
    });
    store = TestBed.inject(ResourcePlannerStore);
  });

  it('loads the heatmap and the bookings of the window of the anchor', async () => {
    await store.goTo('2026-03-04');
    await store.init();

    expect(api['getHeatmap']).toHaveBeenLastCalledWith({
      from: '2026-03-02',
      to: '2026-04-26',
      granularity: 'week',
    });
    expect(api['getAllocations']).toHaveBeenLastCalledWith({ from: '2026-03-02', to: '2026-04-26' });
    expect(store.rows()).toHaveLength(2);
    expect(store.periods()).toEqual(periods);
    expect(store.loading()).toBe(false);
  });

  it('derives the overloaded resources, the departments and the tentative bookings', async () => {
    await store.init();

    expect(store.overloadedEmployeeCount()).toBe(1);
    expect(store.overloaded()[0].row.employee_name).toBe('Anna Rossi');
    expect(store.overloaded()[0].peak).toBe(125);
    expect(store.departments()).toEqual([
      { id: 'd-1', name: 'Engineering' },
      { id: 'd-2', name: 'Design' },
    ]);
    expect(store.softCount()).toBe(1);
    expect(store.isEmpty()).toBe(false);
  });

  it('stacks the bars of every employee on the periods of the heatmap', async () => {
    await store.init();

    const bars = store.barsByEmployee();

    expect(bars['e-1']).toHaveLength(1);
    expect(bars['e-1'][0]).toMatchObject({ column: 2, span: 2, track: 0 });
    expect(bars['e-2'][0].allocation.booking_type).toBe('HardCommitted');
  });

  it('sends the department filter and the granularity of the view', async () => {
    await store.init();

    await store.setDepartment('d-2');
    expect(api['getHeatmap']).toHaveBeenLastCalledWith(
      expect.objectContaining({ department_id: 'd-2', granularity: 'week' }),
    );

    await store.setGranularity('day');
    expect(api['getHeatmap']).toHaveBeenLastCalledWith(
      expect.objectContaining({ department_id: 'd-2', granularity: 'day' }),
    );
    expect(store.granularity()).toBe('day');
  });

  it('moves the window by four weeks with the arrows', async () => {
    await store.goTo('2026-03-04');

    await store.navigate(1);

    expect(store.anchor()).toBe('2026-03-30');
    expect(store.window().from).toBe('2026-03-30');
  });

  it('keeps an empty view and reports the failure of a load', async () => {
    api['getHeatmap'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );

    await store.init();

    expect(store.error()).toBe('resourcePlanning.loadError');
    expect(store.loading()).toBe(false);
    expect(store.isEmpty()).toBe(true);
  });

  it('ignores the answer of a load that was overtaken by a newer one', async () => {
    const slow = new Subject<unknown>();
    api['getHeatmap']
      .mockReturnValueOnce(slow)
      .mockReturnValue(of(wrap({ ...heatmap, rows: [heatmap.rows[1]] })));

    const first = store.loadView();
    await store.loadView();
    slow.next(wrap(heatmap));
    slow.complete();
    await first;

    expect(store.rows()).toHaveLength(1);
  });

  describe('rebalance', () => {
    beforeEach(async () => {
      await store.init();
      api['getHeatmap'].mockClear();
    });

    it('moves a booking to another colleague and reloads the view', async () => {
      const outcome = await store.rebalance(allocation('a-1'), {
        strategy: 'shift',
        shift_days: 7,
        employee_id: 'e-2',
      });

      expect(outcome.ok).toBe(true);
      expect(api['rebalance']).toHaveBeenCalledWith('a-1', {
        strategy: 'shift',
        shift_days: 7,
        employee_id: 'e-2',
      });
      expect(api['getHeatmap']).toHaveBeenCalledTimes(1);
      expect(store.saving()).toBe(false);
    });

    it('exposes the overload verdict and the warnings of the change', async () => {
      api['rebalance'].mockReturnValue(
        of(
          wrap(
            result({
              overload: {
                is_overloaded: true,
                peak_load_percent: 130,
                weeks: [{ week_start: '2026-03-09', load_percent: 130 }],
              },
              warnings: [{ code: 'certificate_expired', params: { skill_name: 'Forklift' } }],
            }),
          ),
        ),
      );

      await store.rebalance(allocation('a-1'), { strategy: 'resize', end_date: '2026-03-29' });

      expect(store.lastResult()?.overload.is_overloaded).toBe(true);
      expect(store.lastResult()?.overload.weeks).toEqual([
        { week_start: '2026-03-09', load_percent: 130 },
      ]);
      expect(store.lastResult()?.warnings[0].code).toBe('certificate_expired');

      store.clearFeedback();
      expect(store.lastResult()).toBeNull();
    });

    it('keeps the view and exposes the rules of a refused change', async () => {
      api['rebalance'].mockReturnValue(
        throwError(() => refused([{ code: 'no_working_days' }, { code: 'invalid_period' }])),
      );

      const outcome = await store.rebalance(allocation('a-1'), {
        strategy: 'split',
        split_date: '2026-03-16',
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.issues.map((issue) => issue.code)).toEqual(['no_working_days', 'invalid_period']);
      expect(store.lastIssues()).toHaveLength(2);
      expect(store.rejectedAllocationId()).toBe('a-1');
      expect(store.error()).toBeNull();
      expect(api['getHeatmap']).not.toHaveBeenCalled();
      expect(store.rows()).toHaveLength(2);
    });

    it('shows the server text of a failure without findings', async () => {
      api['rebalance'].mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 500, error: { detail: 'Database down' } }),
        ),
      );

      const outcome = await store.rebalance(allocation('a-1'), { strategy: 'shift', shift_days: 7 });

      expect(outcome.ok).toBe(false);
      expect(store.error()).toBe('Database down');
    });

    it('cuts a booking in two and reads both parts', async () => {
      api['rebalance'].mockReturnValue(
        of(
          wrap(
            result({
              allocations: [
                allocation('a-1', { end_date: '2026-03-13' }),
                allocation('a-3', { start_date: '2026-03-16' }),
              ],
            }),
          ),
        ),
      );

      const outcome = await store.rebalance(allocation('a-1'), {
        strategy: 'split',
        split_date: '2026-03-16',
      });

      expect(outcome.result?.allocations).toHaveLength(2);
    });
  });

  describe('other changes', () => {
    beforeEach(async () => {
      await store.init();
    });

    it('converts a soft booking to a hard one with the project it needs', async () => {
      const outcome = await store.convertToHard(allocation('a-1', { project_id: null }), {
        project_id: 'p-2',
        wbs_node_id: 'w-1',
      });

      expect(outcome.ok).toBe(true);
      expect(api['convertToHard']).toHaveBeenCalledWith('a-1', {
        project_id: 'p-2',
        wbs_node_id: 'w-1',
      });
    });

    it('reports a booking that is already hard', async () => {
      api['convertToHard'].mockReturnValue(throwError(() => refused([{ code: 'already_hard_committed' }])));

      const outcome = await store.convertToHard(allocation('a-1'));

      expect(outcome.ok).toBe(false);
      expect(outcome.issues[0].code).toBe('already_hard_committed');
    });

    it('deletes a booking and reloads', async () => {
      api['getHeatmap'].mockClear();

      const outcome = await store.remove(allocation('a-1'));

      expect(outcome.ok).toBe(true);
      expect(api['deleteAllocation']).toHaveBeenCalledWith('a-1');
      expect(api['getHeatmap']).toHaveBeenCalledTimes(1);
    });

    it('creates a booking and keeps its overload verdict', async () => {
      api['createAllocation'].mockReturnValue(
        of(
          wrap(
            result({
              overload: { is_overloaded: true, peak_load_percent: 110, weeks: [] },
            }),
          ),
        ),
      );

      const outcome = await store.create({
        employee_id: 'e-2',
        project_id: 'p-1',
        booking_type: 'HardCommitted',
        start_date: '2026-03-09',
        end_date: '2026-03-13',
        allocated_hours_per_day: 4,
      });

      expect(outcome.ok).toBe(true);
      expect(store.lastResult()?.overload.peak_load_percent).toBe(110);
    });
  });
});
