import { MfgCalendarPreviewDay, MfgRoutingStepResult, MfgWorkCenterDetail } from '@core';
import { describe, expect, it } from 'vitest';
import {
  apiErrorText,
  blankOperation,
  calendarTotals,
  calendarWeeks,
  ganttBars,
  lossRows,
  moveOperation,
  oeeStatus,
  operationsPayload,
  workCenterTree,
} from './production-engineering.utils';

const day = (date: string, day_type: MfgCalendarPreviewDay['day_type'], available_minutes = 0): MfgCalendarPreviewDay => ({
  date,
  day_type,
  label: null,
  available_minutes,
  shifts: [],
});

const center = (id: string, code: string, parent: string | null = null): MfgWorkCenterDetail =>
  ({ id, work_center_code: code, name: code, parent_work_center_id: parent }) as MfgWorkCenterDetail;

describe('production engineering utils', () => {
  it('rates a KPI against its target', () => {
    expect(oeeStatus(86, 85)).toBe('ok');
    expect(oeeStatus(80, 85)).toBe('warn');
    expect(oeeStatus(60, 85)).toBe('bad');
    expect(oeeStatus(60, null)).toBe('none');
  });

  it('lists the six losses in order with their share', () => {
    const rows = lossRows({
      equipment_failure: { minutes: 30, factor: 'availability' },
      setup_adjustment: { minutes: 10, factor: 'availability' },
    } as never);

    expect(rows.map((row) => row.category)).toHaveLength(6);
    expect(rows[0]).toMatchObject({ category: 'equipment_failure', minutes: 30, share: 75 });
    expect(rows[5].share).toBe(0);
    expect(lossRows(undefined).every((row) => row.minutes === 0 && row.share === 0)).toBe(true);
  });

  it('lays previewed days out as Monday-first weeks', () => {
    // 2026-12-02 is a Wednesday: the first week starts on Monday 30 November.
    const weeks = calendarWeeks([day('2026-12-02', 'working_shift', 480), day('2026-12-03', 'holiday'), day('2026-12-09', 'working_shift', 480)]);

    expect(weeks).toHaveLength(2);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe('2026-11-30');
    expect(weeks[0][0].inRange).toBe(false);
    expect(weeks[0][2]).toMatchObject({ date: '2026-12-02', inRange: true });
    expect(weeks[0][3].preview?.day_type).toBe('holiday');
    expect(calendarWeeks([])).toEqual([]);
  });

  it('totals the days by type and the available hours', () => {
    const totals = calendarTotals([day('2026-12-01', 'working_shift', 480), day('2026-12-02', 'working_shift', 450), day('2026-12-03', 'planned_shutdown')]);

    expect(totals).toMatchObject({ working_shift: 2, planned_shutdown: 1, holiday: 0, hours: 15.5 });
  });

  it('orders work centres as a tree, treating unknown parents as roots', () => {
    const rows = workCenterTree([center('3', 'C'), center('2', 'B', '1'), center('1', 'A'), center('4', 'D', 'missing')]);

    expect(rows.map((row) => `${row.center.work_center_code}:${row.depth}`)).toEqual(['A:0', 'B:1', 'C:0', 'D:0']);
  });

  it('moves operations without leaving the list', () => {
    expect(moveOperation(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveOperation(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveOperation(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('renumbers the sequences and cleans the operations before saving', () => {
    const first = { ...blankOperation('w1'), id: 'x', name: 'Cut', setup_time_minutes: '12.5', overlap_transfer_batch_qty: '', machine_center_id: '' };
    const second = { ...blankOperation('w2'), name: 'Outsource', operation_type: 'external_subcontracting' as const, work_instruction_doc_id: '' };

    const [a, b] = operationsPayload([first, second]);

    expect(a.sequence).toBe(10);
    expect(b.sequence).toBe(20);
    expect(a).not.toHaveProperty('id');
    expect(a.setup_time_minutes).toBe(12.5);
    expect(a.overlap_transfer_batch_qty).toBeNull();
    expect(a.machine_center_id).toBeNull();
    expect(a.is_subcontracted).toBe(false);
    expect(b.is_subcontracted).toBe(true);
    expect(b.work_instruction_doc_id).toBeNull();
  });

  it('places the simulated steps on a common time axis', () => {
    const step = (id: string, start: number, end: number): MfgRoutingStepResult =>
      ({ operation_id: id, start_offset_minutes: start, end_offset_minutes: end }) as MfgRoutingStepResult;

    const bars = ganttBars([step('a', 0, 50), step('b', '25' as never, '100' as never)]);

    expect(bars[0]).toMatchObject({ left: 0, width: 50 });
    expect(bars[1]).toMatchObject({ left: 25, width: 75 });
    expect(ganttBars([step('z', 0, 0)])[0].width).toBe(0);
  });

  it('reads the first validation message of an API error', () => {
    expect(apiErrorText({ error: { message: 'Invalid', errors: { code: ['Taken'] } } })).toBe('Taken');
    expect(apiErrorText({ error: { message: 'Conflict' } })).toBe('Conflict');
    expect(apiErrorText(new Error('x'))).toBeNull();
  });
});
