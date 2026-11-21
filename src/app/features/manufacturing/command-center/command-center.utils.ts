import {
  MfgCapacityDay,
  MfgMachineState,
  MfgOrderOperation,
  MfgProductionStrategy,
  MFG_MACHINE_STATES,
  MFG_STRATEGIES,
} from '@core';

const DAY_MS = 86_400_000;
const EPSILON = 0.005;

/** A decimal string of the API as a number (non-numeric and empty values count as 0). */
export function num(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Availability, performance, quality and OEE arrive as ratios (0..1): the percentage with one decimal. */
export function ratioPercent(value: string | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(num(value) * 1000) / 10;
}

// --- Cockpit helpers -------------------------------------------------------------------------------------------------

export interface PipelineStage {
  strategy: MfgProductionStrategy;
  count: number;
  share: number;
}

/** The open orders by MTO/MTS/ATO with their share of the open orders (0..100). */
export function pipelineStages(byStrategy: Partial<Record<MfgProductionStrategy, number>>): PipelineStage[] {
  const total = MFG_STRATEGIES.reduce((sum, strategy) => sum + (byStrategy[strategy] ?? 0), 0);

  return MFG_STRATEGIES.map((strategy) => {
    const count = byStrategy[strategy] ?? 0;
    return { strategy, count, share: total === 0 ? 0 : Math.round((count / total) * 1000) / 10 };
  });
}

export function machineStateCounts(byState: Partial<Record<MfgMachineState, number>>): { state: MfgMachineState; count: number }[] {
  return MFG_MACHINE_STATES.map((state) => ({ state, count: byState[state] ?? 0 }));
}

export interface WipBars {
  valuation: number;
  standard: number;
  max: number;
  /** Positive: WIP above standard (unfavourable). */
  variance: number;
}

export function wipBars(wip: { valuation: string; standard_cost: string; variance: string }): WipBars {
  const valuation = num(wip.valuation);
  const standard = num(wip.standard_cost);
  return { valuation, standard, max: Math.max(valuation, standard, 1), variance: num(wip.variance) };
}

/** The SVG arc path of a gauge sweeping `percent` (0..100) of a half circle. */
export function gaugeArc(percent: number, radius = 54, cx = 70, cy = 70): string {
  const clamped = Math.min(100, Math.max(0, percent));
  if (clamped === 0) {
    return '';
  }
  const angle = Math.PI * (clamped / 100);
  const x = cx - radius * Math.cos(angle);
  const y = cy - radius * Math.sin(angle);
  return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

/** World-class OEE is 85%; below 60% is poor. */
export function oeeBand(percent: number | null): 'good' | 'warn' | 'bad' | 'none' {
  if (percent === null) {
    return 'none';
  }
  return percent >= 85 ? 'good' : percent >= 60 ? 'warn' : 'bad';
}

// --- Dates -----------------------------------------------------------------------------------------------------------

/** The day number (days since the epoch, UTC) of an ISO date or date-time. */
export function dayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function isoOfDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return isoOfDay(dayIndex(isoDate) + days);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return dayIndex(toIso) - dayIndex(fromIso);
}

// --- Gantt and finite-capacity validation ----------------------------------------------------------------------------

export interface GanttWindow {
  start: string;
  end: string;
}

/** The dates of an order moved by `deltaDays`, keeping its duration. */
export function shiftWindow(window: GanttWindow, deltaDays: number): GanttWindow {
  return { start: addDays(window.start, deltaDays), end: addDays(window.end, deltaDays) };
}

/** The whole days a pointer drag of `deltaPx` moved a bar of a timeline with `dayWidth` pixels per day. */
export function dragDeltaDays(deltaPx: number, dayWidth: number): number {
  return dayWidth <= 0 ? 0 : Math.round(deltaPx / dayWidth);
}

export interface BarGeometry {
  left: number;
  width: number;
}

/** Position of a bar (inclusive of its last day) on a timeline starting at `timelineStart`. */
export function barGeometry(window: GanttWindow, timelineStart: string, dayWidth: number): BarGeometry {
  const offset = daysBetween(timelineStart, window.start);
  const length = daysBetween(window.start, window.end) + 1;
  return { left: offset * dayWidth, width: Math.max(1, length) * dayWidth };
}

export interface WorkCenterDemand {
  workCenterId: string;
  /** Planned setup + run hours of the not yet completed operations of the order on that work centre. */
  hours: number;
}

/** The planned hours of the open operations per work centre. */
export function demandsOf(operations: readonly MfgOrderOperation[]): WorkCenterDemand[] {
  const byCenter = new Map<string, number>();
  for (const operation of operations) {
    if (operation.work_center_id === null || operation.is_subcontracted || operation.status === 'completed') {
      continue;
    }
    const hours = (num(operation.planned_setup_minutes) + num(operation.planned_run_minutes)) / 60;
    byCenter.set(operation.work_center_id, (byCenter.get(operation.work_center_id) ?? 0) + hours);
  }
  return [...byCenter].map(([workCenterId, hours]) => ({ workCenterId, hours: Math.round(hours * 100) / 100 }));
}

/**
 * The hours the order itself books on a work centre inside a window: the capacity endpoint counts the load of released
 * orders, so a released order moved within its own window must not collide with its own booking.
 */
export function ownBookedHours(operations: readonly MfgOrderOperation[], workCenterId: string, window: GanttWindow): number {
  const start = dayIndex(window.start);
  const end = dayIndex(window.end);
  const minutes = operations
    .filter(
      (operation) =>
        operation.work_center_id === workCenterId &&
        operation.status !== 'completed' &&
        operation.scheduled_date !== null &&
        dayIndex(operation.scheduled_date) >= start &&
        dayIndex(operation.scheduled_date) <= end,
    )
    .reduce((sum, operation) => sum + num(operation.planned_setup_minutes) + num(operation.planned_run_minutes), 0);
  return minutes / 60;
}

export type RescheduleIssueCode = 'status' | 'range' | 'overload' | 'no_capacity';

export interface RescheduleIssue {
  code: RescheduleIssueCode;
  workCenterId?: string;
  requiredHours?: number;
  freeHours?: number;
}

export interface RescheduleCheck {
  ok: boolean;
  issues: RescheduleIssue[];
}

export interface RescheduleInput {
  status: string;
  target: GanttWindow;
  demands: readonly WorkCenterDemand[];
  /** Capacity days of the target window per work centre (`GET /work-centers/{id}/capacity`). */
  capacity: Readonly<Record<string, readonly MfgCapacityDay[]>>;
  /** The load the order itself already books inside the target window per work centre. */
  ownBooked?: Readonly<Record<string, number>>;
}

/**
 * Finite-capacity check of a reschedule. The API only checks the status and the date order, so the overload check is done
 * here against the capacity endpoint: the hours the order needs on each work centre must fit in the free hours
 * (available minus the load of other orders) of the target window.
 */
export function validateReschedule(input: RescheduleInput): RescheduleCheck {
  const issues: RescheduleIssue[] = [];

  if (input.status !== 'planned' && input.status !== 'released') {
    return { ok: false, issues: [{ code: 'status' }] };
  }
  if (daysBetween(input.target.start, input.target.end) < 0) {
    return { ok: false, issues: [{ code: 'range' }] };
  }

  for (const demand of input.demands) {
    const days = (input.capacity[demand.workCenterId] ?? []).filter(
      (day) => dayIndex(day.date) >= dayIndex(input.target.start) && dayIndex(day.date) <= dayIndex(input.target.end),
    );
    const available = days.reduce((sum, day) => sum + num(day.available_hours), 0);
    const loaded = days.reduce((sum, day) => sum + num(day.load_hours), 0);
    const own = input.ownBooked?.[demand.workCenterId] ?? 0;
    const free = Math.max(0, available - Math.max(0, loaded - own));

    if (demand.hours > free + EPSILON) {
      issues.push({
        code: available <= EPSILON ? 'no_capacity' : 'overload',
        workCenterId: demand.workCenterId,
        requiredHours: demand.hours,
        freeHours: Math.round(free * 100) / 100,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

// --- Kiosk timer -----------------------------------------------------------------------------------------------------

export interface TimerState {
  /** Epoch ms of the last start, null while paused or idle. */
  runningSince: number | null;
  /** Milliseconds accumulated before the last start. */
  accumulatedMs: number;
}

export const IDLE_TIMER: TimerState = { runningSince: null, accumulatedMs: 0 };

export const startTimer = (timer: TimerState, now: number): TimerState =>
  timer.runningSince === null ? { ...timer, runningSince: now } : timer;

export const pauseTimer = (timer: TimerState, now: number): TimerState =>
  timer.runningSince === null
    ? timer
    : { runningSince: null, accumulatedMs: timer.accumulatedMs + Math.max(0, now - timer.runningSince) };

export const elapsedMs = (timer: TimerState, now: number): number =>
  timer.accumulatedMs + (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));

/** Elapsed run time in minutes as the decimal string the API takes (at most 2 decimals, rounded up). */
export const minutesOf = (ms: number): string => (Math.ceil((ms / 60_000) * 100) / 100).toFixed(2);

export function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** A quantity string the API accepts: a non-negative decimal with at most 4 fraction digits. */
export function toQuantity(value: number): string {
  return (Math.round(Math.max(0, value) * 10_000) / 10_000).toString();
}
