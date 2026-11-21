import {
  MfgCalendarDayType,
  MfgCalendarPreviewDay,
  MfgOeeLossCategory,
  MfgOeeResult,
  MfgRoutingOperationDetail,
  MfgRoutingStepResult,
  MfgWorkCenterDetail,
} from '@core';

export const toNum = (value: string | number | null | undefined): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');

  return Number.isFinite(parsed) ? parsed : 0;
};

export const LOSS_ORDER: readonly MfgOeeLossCategory[] = [
  'equipment_failure',
  'setup_adjustment',
  'minor_stops',
  'reduced_speed',
  'process_defects',
  'startup_rejects',
];

export const DAY_TYPES: readonly MfgCalendarDayType[] = ['working_shift', 'holiday', 'non_working_weekend', 'planned_shutdown'];

export type OeeStatus = 'ok' | 'warn' | 'bad' | 'none';

/** Traffic light of a KPI against its target: at target is ok, within 10 points below it warn, otherwise bad. */
export function oeeStatus(value: number, target: number | null | undefined): OeeStatus {
  if (target === null || target === undefined) {
    return 'none';
  }
  if (value >= target) {
    return 'ok';
  }

  return value >= target - 10 ? 'warn' : 'bad';
}

export interface LossRow {
  category: MfgOeeLossCategory;
  minutes: number;
  /** Share of the lost minutes, 0-100. */
  share: number;
  factor: string;
}

/** The six big losses, in the canonical order, with the share of each one over the total. */
export function lossRows(losses: MfgOeeResult['six_big_losses'] | undefined): LossRow[] {
  const total = LOSS_ORDER.reduce((sum, key) => sum + toNum(losses?.[key]?.minutes), 0);

  return LOSS_ORDER.map((category) => {
    const minutes = toNum(losses?.[category]?.minutes);

    return {
      category,
      minutes,
      share: total > 0 ? Math.round((minutes / total) * 1000) / 10 : 0,
      factor: losses?.[category]?.factor ?? '',
    };
  });
}

export interface CalendarCell {
  date: string;
  day: number;
  inRange: boolean;
  preview: MfgCalendarPreviewDay | null;
}

/** Previewed days laid out as weeks (Monday first), padded to full weeks so they can be drawn as a month grid. */
export function calendarWeeks(days: readonly MfgCalendarPreviewDay[]): CalendarCell[][] {
  if (days.length === 0) {
    return [];
  }
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const last = new Date(`${days[days.length - 1].date}T00:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7;
  const start = first.getTime() - lead * 86_400_000;
  const span = Math.round((last.getTime() - start) / 86_400_000) + 1;
  const weeks: CalendarCell[][] = [];

  for (let offset = 0; offset < Math.ceil(span / 7) * 7; offset += 1) {
    const cursor = new Date(start + offset * 86_400_000);
    const iso = cursor.toISOString().slice(0, 10);
    if (offset % 7 === 0) {
      weeks.push([]);
    }
    weeks[weeks.length - 1].push({
      date: iso,
      day: cursor.getUTCDate(),
      inRange: byDate.has(iso),
      preview: byDate.get(iso) ?? null,
    });
  }

  return weeks;
}

/** Hours of work per day type over the previewed window. */
export function calendarTotals(days: readonly MfgCalendarPreviewDay[]): Record<MfgCalendarDayType, number> & { hours: number } {
  const totals = { working_shift: 0, holiday: 0, non_working_weekend: 0, planned_shutdown: 0, hours: 0 };
  for (const day of days) {
    totals[day.day_type] += 1;
    totals.hours += day.available_minutes / 60;
  }
  totals.hours = Math.round(totals.hours * 10) / 10;

  return totals;
}

/** Work centres as a tree: roots first, children grouped under their parent (orphans count as roots), codes in order. */
export interface WorkCenterNode {
  center: MfgWorkCenterDetail;
  depth: number;
}

export function workCenterTree(centers: readonly MfgWorkCenterDetail[]): WorkCenterNode[] {
  const ids = new Set(centers.map((center) => center.id));
  const children = new Map<string | null, MfgWorkCenterDetail[]>();
  for (const center of centers) {
    const parent = center.parent_work_center_id && ids.has(center.parent_work_center_id) ? center.parent_work_center_id : null;
    children.set(parent, [...(children.get(parent) ?? []), center]);
  }
  const out: WorkCenterNode[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number): void => {
    for (const center of (children.get(parent) ?? []).sort((a, b) => a.work_center_code.localeCompare(b.work_center_code))) {
      if (seen.has(center.id)) {
        continue;
      }
      seen.add(center.id);
      out.push({ center, depth });
      walk(center.id, depth + 1);
    }
  };
  walk(null, 0);

  return out;
}

let operationCounter = 0;

/** A blank operation for the designer, with a code that is unique within the session. */
export function blankOperation(workCenterId = ''): MfgRoutingOperationDetail {
  operationCounter += 1;

  return {
    operation_code: `OP${String(operationCounter * 10).padStart(3, '0')}`,
    name: '',
    work_center_id: workCenterId,
    machine_center_id: null,
    operation_type: 'internal_machining',
    setup_time_minutes: 0,
    run_time_minutes_per_unit: 0,
    queue_time_minutes: 0,
    post_operation_wait_minutes: 0,
    move_time_minutes: 0,
    overlap_transfer_batch_qty: null,
    required_operators: 1,
    alternate_work_center_ids: [],
    bom_components: [],
  };
}

/** Moves an operation up or down; out of range moves return the same list. */
export function moveOperation<T>(operations: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= operations.length || target < 0 || target >= operations.length) {
    return [...operations];
  }
  const copy = [...operations];
  [copy[index], copy[target]] = [copy[target], copy[index]];

  return copy;
}

const NUMERIC_FIELDS = [
  'setup_time_minutes',
  'run_time_minutes_per_unit',
  'labor_time_minutes_per_unit',
  'queue_time_minutes',
  'post_operation_wait_minutes',
  'move_time_minutes',
  'overlap_transfer_batch_qty',
  'subcontract_unit_cost',
] as const;

/**
 * Operations ready to be sent: sequences renumbered 10, 20, 30... in list order, numeric strings converted, empty optional
 * values removed and subcontracting kept consistent with the operation type.
 */
export function operationsPayload(operations: readonly MfgRoutingOperationDetail[]): MfgRoutingOperationDetail[] {
  return operations.map((source, index) => {
    const operation: Record<string, unknown> = { ...source };
    delete operation['id'];
    operation['sequence'] = (index + 1) * 10;
    for (const field of NUMERIC_FIELDS) {
      const raw = operation[field];
      operation[field] = raw === null || raw === undefined || raw === '' ? null : toNum(raw as string | number);
    }
    operation['machine_center_id'] = operation['machine_center_id'] || null;
    operation['linked_quality_control_point_id'] = operation['linked_quality_control_point_id'] || null;
    operation['work_instruction_doc_id'] = operation['work_instruction_doc_id'] || null;
    operation['is_subcontracted'] = source.operation_type === 'external_subcontracting';

    return operation as unknown as MfgRoutingOperationDetail;
  });
}

export interface GanttBar {
  step: MfgRoutingStepResult;
  /** Left edge and width in percent of the whole lead time. */
  left: number;
  width: number;
}

/** Bars of the simulated steps on a common time axis (offsets in minutes from the start). */
export function ganttBars(steps: readonly MfgRoutingStepResult[]): GanttBar[] {
  const total = steps.reduce((max, step) => Math.max(max, toNum(step.end_offset_minutes)), 0);
  if (total <= 0) {
    return steps.map((step) => ({ step, left: 0, width: 0 }));
  }

  return steps.map((step) => {
    const start = toNum(step.start_offset_minutes);
    const end = toNum(step.end_offset_minutes);

    return { step, left: (start / total) * 100, width: Math.max(((end - start) / total) * 100, 0.5) };
  });
}

/** Local `YYYY-MM-DD` of a date. */
export const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** First validation message of a Laravel 422 body, or the message of the error, or null. */
export function apiErrorText(error: unknown): string | null {
  const body = (error as { error?: { message?: unknown; errors?: Record<string, string[]> } } | null)?.error;
  const first = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
  if (first) {
    return first;
  }

  return typeof body?.message === 'string' && body.message !== '' ? body.message : null;
}
