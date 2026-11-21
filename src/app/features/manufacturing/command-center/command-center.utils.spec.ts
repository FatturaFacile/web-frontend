import { MfgCapacityDay, MfgOrderOperation } from '@core';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  barGeometry,
  clock,
  demandsOf,
  dragDeltaDays,
  elapsedMs,
  gaugeArc,
  IDLE_TIMER,
  minutesOf,
  oeeBand,
  ownBookedHours,
  pauseTimer,
  pipelineStages,
  ratioPercent,
  shiftWindow,
  startTimer,
  toQuantity,
  validateReschedule,
  wipBars,
} from './command-center.utils';

const day = (date: string, available: string, load: string): MfgCapacityDay => ({
  date,
  gross_hours: available,
  available_hours: available,
  load_hours: load,
  utilization_percent: null,
  is_exception: false,
});

const operation = (overrides: Partial<MfgOrderOperation>): MfgOrderOperation => ({
  id: 'op',
  sequence: 10,
  operation_code: null,
  name: 'Turn',
  work_center_id: 'wc-1',
  status: 'pending',
  is_subcontracted: false,
  scheduled_date: null,
  planned_setup_minutes: '60',
  planned_run_minutes: '180',
  planned_labor_minutes: null,
  actual_setup_minutes: '0',
  actual_run_minutes: '0',
  completed_quantity: '0',
  scrapped_quantity: '0',
  ...overrides,
});

describe('Gantt rescheduling validation', () => {
  const target = { start: '2026-03-02', end: '2026-03-03' };
  const demands = [{ workCenterId: 'wc-1', hours: 8 }];

  it('accepts a move that fits the free hours of the target window', () => {
    const result = validateReschedule({
      status: 'planned',
      target,
      demands,
      capacity: { 'wc-1': [day('2026-03-02', '8', '2'), day('2026-03-03', '8', '0')] },
    });
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it('refuses an overload with the missing hours of the work centre', () => {
    const result = validateReschedule({
      status: 'planned',
      target,
      demands,
      capacity: { 'wc-1': [day('2026-03-02', '8', '6'), day('2026-03-03', '8', '6')] },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ code: 'overload', workCenterId: 'wc-1', requiredHours: 8, freeHours: 4 }]);
  });

  it('reports no capacity when the work centre is closed in the window', () => {
    const result = validateReschedule({
      status: 'released',
      target,
      demands,
      capacity: { 'wc-1': [day('2026-03-02', '0', '0'), day('2026-03-03', '0', '0')] },
    });
    expect(result.issues[0]?.code).toBe('no_capacity');
  });

  it('ignores capacity days outside the target window', () => {
    const result = validateReschedule({
      status: 'planned',
      target,
      demands,
      capacity: { 'wc-1': [day('2026-03-01', '24', '0'), day('2026-03-02', '2', '0')] },
    });
    expect(result.ok).toBe(false);
  });

  it('does not count the own booking of a released order as load of others', () => {
    const capacity = { 'wc-1': [day('2026-03-02', '8', '8'), day('2026-03-03', '0', '0')] };
    expect(validateReschedule({ status: 'released', target, demands, capacity }).ok).toBe(false);
    expect(validateReschedule({ status: 'released', target, demands, capacity, ownBooked: { 'wc-1': 8 } }).ok).toBe(true);
  });

  it('refuses started orders and inverted ranges without looking at the capacity', () => {
    expect(validateReschedule({ status: 'in_progress', target, demands, capacity: {} }).issues[0]?.code).toBe('status');
    expect(
      validateReschedule({ status: 'planned', target: { start: '2026-03-05', end: '2026-03-04' }, demands, capacity: {} }).issues[0]?.code,
    ).toBe('range');
  });

  it('accepts an order without capacity-bound operations', () => {
    expect(validateReschedule({ status: 'planned', target, demands: [], capacity: {} }).ok).toBe(true);
  });

  it('sums setup and run hours per work centre and skips completed and subcontracted operations', () => {
    const result = demandsOf([
      operation({ id: 'a' }),
      operation({ id: 'b', planned_setup_minutes: '0', planned_run_minutes: '120' }),
      operation({ id: 'c', status: 'completed' }),
      operation({ id: 'd', is_subcontracted: true }),
      operation({ id: 'e', work_center_id: 'wc-2', planned_setup_minutes: '30', planned_run_minutes: '30' }),
    ]);
    expect(result).toEqual([
      { workCenterId: 'wc-1', hours: 6 },
      { workCenterId: 'wc-2', hours: 1 },
    ]);
  });

  it('counts the own booked hours of the operations scheduled inside the window', () => {
    const operations = [operation({ scheduled_date: '2026-03-02' }), operation({ id: 'out', scheduled_date: '2026-03-20' })];
    expect(ownBookedHours(operations, 'wc-1', target)).toBe(4);
  });

  it('moves a window by whole days and converts drags to days', () => {
    expect(shiftWindow({ start: '2026-02-27', end: '2026-03-02' }, 2)).toEqual({ start: '2026-03-01', end: '2026-03-04' });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dragDeltaDays(57, 28)).toBe(2);
    expect(dragDeltaDays(-40, 28)).toBe(-1);
    expect(dragDeltaDays(10, 0)).toBe(0);
  });

  it('positions a bar inclusive of its last day', () => {
    expect(barGeometry({ start: '2026-03-03', end: '2026-03-05' }, '2026-03-01', 10)).toEqual({ left: 20, width: 30 });
  });
});

describe('cockpit helpers', () => {
  it('shares the open orders over MTO, MTS and ATO', () => {
    expect(pipelineStages({ MTO: 3, MTS: 1 })).toEqual([
      { strategy: 'MTO', count: 3, share: 75 },
      { strategy: 'MTS', count: 1, share: 25 },
      { strategy: 'ATO', count: 0, share: 0 },
    ]);
    expect(pipelineStages({}).every((stage) => stage.share === 0)).toBe(true);
  });

  it('converts ratios, bands and arcs', () => {
    expect(ratioPercent('0.8567')).toBe(85.7);
    expect(ratioPercent(null)).toBeNull();
    expect(oeeBand(90)).toBe('good');
    expect(oeeBand(70)).toBe('warn');
    expect(oeeBand(10)).toBe('bad');
    expect(oeeBand(null)).toBe('none');
    expect(gaugeArc(0)).toBe('');
    expect(gaugeArc(100)).toContain('A 54 54');
  });

  it('scales the WIP bars to the larger value', () => {
    expect(wipBars({ valuation: '150.00', standard_cost: '100.00', variance: '50.00' })).toEqual({
      valuation: 150,
      standard: 100,
      max: 150,
      variance: 50,
    });
  });
});

describe('kiosk timer', () => {
  it('accumulates across pauses', () => {
    let timer = startTimer(IDLE_TIMER, 1000);
    timer = pauseTimer(timer, 61_000);
    expect(elapsedMs(timer, 500_000)).toBe(60_000);
    timer = startTimer(timer, 100_000);
    expect(elapsedMs(timer, 130_000)).toBe(90_000);
  });

  it('does not restart a running timer or pause an idle one', () => {
    const running = startTimer(IDLE_TIMER, 10);
    expect(startTimer(running, 99)).toBe(running);
    expect(pauseTimer(IDLE_TIMER, 99)).toBe(IDLE_TIMER);
  });

  it('formats clock and API values', () => {
    expect(clock(3_725_000)).toBe('01:02:05');
    expect(minutesOf(90_000)).toBe('1.50');
    expect(minutesOf(1)).toBe('0.01');
    expect(toQuantity(3)).toBe('3');
    expect(toQuantity(-2)).toBe('0');
  });
});
