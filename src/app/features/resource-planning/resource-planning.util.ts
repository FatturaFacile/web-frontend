import { HttpErrorResponse } from '@angular/common/http';
import {
  AllocationPayload,
  BookingType,
  CandidateSearchPayload,
  CapacityBand,
  CapacityCell,
  CapacityHeatmap,
  CapacityRow,
  CapacityThresholds,
  CertificationStatus,
  HeatmapGranularity,
  PlanningIssue,
  RebalancePayload,
  ResourceAllocation,
  ResourceCandidate,
  ResourcePlanningProblem,
  SkillPayload,
  UtilizationStatus,
} from '@core';

export const DEFAULT_THRESHOLDS: CapacityThresholds = { yellow: 80, red: 100 };

/** Periods on screen: eight weeks or two weeks of days. */
const WINDOW_PERIODS: Readonly<Record<HeatmapGranularity, number>> = { week: 8, day: 14 };
/** How far the arrows move the window. */
const WINDOW_STEP_DAYS: Readonly<Record<HeatmapGranularity, number>> = { week: 28, day: 7 };

// --- Dates (ISO `Y-m-d`, always read and written as UTC so a date never moves with the time zone) ---

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const value = parse(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** The Monday of the week that contains the date (weeks of the planner start on Monday). */
export function mondayOf(date: string): string {
  return addDays(date, -((parse(date).getUTCDay() + 6) % 7));
}

export function periodStartOf(date: string, granularity: HeatmapGranularity): string {
  return granularity === 'week' ? mondayOf(date) : date;
}

export function periodEndOf(date: string, granularity: HeatmapGranularity): string {
  return granularity === 'week' ? addDays(mondayOf(date), 6) : date;
}

/** The window the planner loads around an anchor date: it starts on the Monday (week) or on the day itself. */
export function windowOf(
  anchor: string,
  granularity: HeatmapGranularity,
): { from: string; to: string } {
  const from = periodStartOf(anchor, granularity);
  const length = WINDOW_PERIODS[granularity] * (granularity === 'week' ? 7 : 1);
  return { from, to: addDays(from, length - 1) };
}

export function moveAnchor(
  anchor: string,
  granularity: HeatmapGranularity,
  direction: -1 | 1,
): string {
  return addDays(periodStartOf(anchor, granularity), WINDOW_STEP_DAYS[granularity] * direction);
}

// --- Saturation bands ---

/** Band of a load: grey without capacity and bookings, green below 80 %, yellow up to 100 %, red above (overload). */
export function bandOf(
  loadPercent: number,
  hasActivity: boolean,
  thresholds: CapacityThresholds = DEFAULT_THRESHOLDS,
): CapacityBand {
  if (!hasActivity) {
    return 'none';
  }
  if (loadPercent > thresholds.red) {
    return 'red';
  }
  return loadPercent >= thresholds.yellow ? 'yellow' : 'green';
}

const BANDS: readonly CapacityBand[] = ['none', 'green', 'yellow', 'red'];

/** The band the API sent, or the one the thresholds give when the answer carries none. */
export function effectiveBand(
  cell: CapacityCell,
  thresholds: CapacityThresholds = DEFAULT_THRESHOLDS,
): CapacityBand {
  if (BANDS.includes(cell.band)) {
    return cell.band;
  }
  return bandOf(
    cell.load_percent,
    cell.net_available_hours > 0 || cell.hard_booked_hours + cell.soft_booked_hours > 0,
    thresholds,
  );
}

export function isOverloadedCell(
  cell: CapacityCell,
  thresholds: CapacityThresholds = DEFAULT_THRESHOLDS,
): boolean {
  return cell.is_overloaded || effectiveBand(cell, thresholds) === 'red';
}

/** The rows with at least one overloaded period, with the periods that are. */
export function overloadedRows(
  heatmap: CapacityHeatmap | null,
): { row: CapacityRow; periods: string[]; peak: number }[] {
  if (heatmap === null) {
    return [];
  }
  const found: { row: CapacityRow; periods: string[]; peak: number }[] = [];
  for (const row of heatmap.rows) {
    const cells = row.cells.filter((cell) => isOverloadedCell(cell, heatmap.thresholds));
    if (cells.length > 0) {
      found.push({
        row,
        periods: cells.map((cell) => cell.period_start),
        peak: Math.max(...cells.map((cell) => cell.load_percent)),
      });
    }
  }
  return found;
}

/** Load of a cell for the progress bar: capped at 100, the overrun is in the number. */
export function loadBarPercent(cell: CapacityCell): number {
  return Math.max(0, Math.min(100, Math.round(cell.load_percent)));
}

export function formatHours(hours: number): string {
  return `${Number(hours.toFixed(1))}h`;
}

export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

// --- Allocation bars ---

export interface AllocationBar {
  allocation: ResourceAllocation;
  /** 1-based grid column of the first visible period. */
  column: number;
  span: number;
  /** Lane of the bar inside its row: overlapping bookings are stacked. */
  track: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/**
 * Places the bookings of one employee on the periods of the heatmap: a bar covers every period it touches and
 * overlapping bars go to separate lanes. A booking outside the window has no bar.
 */
export function stackBars(
  allocations: readonly ResourceAllocation[],
  periods: readonly string[],
  granularity: HeatmapGranularity,
): AllocationBar[] {
  if (periods.length === 0) {
    return [];
  }
  const lastPeriodEnd = periodEndOf(periods[periods.length - 1], granularity);
  const placed: AllocationBar[] = [];

  const visible = allocations
    .filter(
      (allocation) => allocation.end_date >= periods[0] && allocation.start_date <= lastPeriodEnd,
    )
    .sort(
      (a, b) =>
        a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date),
    );
  const trackEnds: number[] = [];

  for (const allocation of visible) {
    let first = periods.findIndex(
      (period) => periodEndOf(period, granularity) >= allocation.start_date,
    );
    if (first < 0) {
      first = 0;
    }
    let last = periods.length - 1;
    for (let index = periods.length - 1; index >= 0; index--) {
      if (periods[index] <= allocation.end_date) {
        last = index;
        break;
      }
    }
    last = Math.max(first, last);

    let track = trackEnds.findIndex((end) => end < first);
    if (track < 0) {
      track = trackEnds.length;
      trackEnds.push(last);
    } else {
      trackEnds[track] = last;
    }

    placed.push({
      allocation,
      column: first + 1,
      span: last - first + 1,
      track,
      clippedStart: allocation.start_date < periods[0],
      clippedEnd: allocation.end_date > lastPeriodEnd,
    });
  }
  return placed;
}

// --- Drag and drop ---

export type DragMode = 'move' | 'resize-start' | 'resize-end';

/** The cell a bar is dropped on: a colleague row at a period. */
export interface DropTarget {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
}

export interface DropOptions {
  /** First period of the window: a bar clipped by it moves relative to the visible edge. */
  windowStart: string;
  /** Shift held: cut the booking at the dropped period instead of moving it. */
  split?: boolean;
}

/**
 * The rebalance request a drop stands for, or null when the drop changes nothing:
 * - move: `shift` by whole periods, with `employee_id` when dropped on a colleague row;
 * - move with the split modifier: `split` at the dropped period, the second part goes to the row;
 * - resize handles: `resize` to the end of (or from the start of) the dropped period.
 */
export function planDrop(
  allocation: ResourceAllocation,
  mode: DragMode,
  target: DropTarget,
  granularity: HeatmapGranularity,
  options: DropOptions,
): RebalancePayload | null {
  const otherEmployee = target.employeeId !== allocation.employee_id;

  if (mode === 'resize-end') {
    const nextEnd = target.periodEnd;
    const sameEnd = periodEndOf(allocation.end_date, granularity) === nextEnd;
    return sameEnd || nextEnd < allocation.start_date
      ? null
      : { strategy: 'resize', end_date: nextEnd };
  }

  if (mode === 'resize-start') {
    const nextStart = target.periodStart;
    const sameStart = periodStartOf(allocation.start_date, granularity) === nextStart;
    return sameStart || nextStart > allocation.end_date
      ? null
      : { strategy: 'resize', start_date: nextStart };
  }

  if (options.split) {
    const at = target.periodStart;
    return at > allocation.start_date && at <= allocation.end_date
      ? { strategy: 'split', split_date: at, ...(otherEmployee ? { employee_id: target.employeeId } : {}) }
      : null;
  }

  const visibleStart =
    allocation.start_date < options.windowStart
      ? options.windowStart
      : periodStartOf(allocation.start_date, granularity);
  const shiftDays = daysBetween(visibleStart, target.periodStart);

  if (shiftDays === 0 && !otherEmployee) {
    return null;
  }
  return {
    strategy: 'shift',
    shift_days: shiftDays,
    ...(otherEmployee ? { employee_id: target.employeeId } : {}),
  };
}

/** A cut is possible strictly after the first day, up to the last. */
export function canSplitAt(allocation: ResourceAllocation, date: string): boolean {
  return date > allocation.start_date && date <= allocation.end_date;
}

/** A soft booking that has no project yet needs one to become hard. */
export function needsProjectToConvert(allocation: ResourceAllocation): boolean {
  return allocation.booking_type === 'SoftTentative' && allocation.project_id === null;
}

// --- Candidate search and one-click allocation ---

export interface CandidateSearchInput {
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  requirements: readonly { skill_id: string; min_level: number }[];
  projectId?: string | null;
  wbsNodeId?: string | null;
  departmentId?: string | null;
  requireValidCertificates: boolean;
  includeIneligible: boolean;
}

/** The search request of the drawer: requirements without a skill are dropped, empty optional fields are left out. */
export function buildCandidateSearch(input: CandidateSearchInput): CandidateSearchPayload {
  return {
    start_date: input.startDate,
    end_date: input.endDate,
    allocated_hours_per_day: input.hoursPerDay,
    requirements: input.requirements
      .filter((requirement) => requirement.skill_id !== '')
      .map((requirement) => ({
        skill_id: requirement.skill_id,
        min_level: Math.min(5, Math.max(1, Math.round(requirement.min_level))),
      })),
    ...(input.projectId ? { project_id: input.projectId } : {}),
    ...(input.projectId && input.wbsNodeId ? { wbs_node_id: input.wbsNodeId } : {}),
    ...(input.departmentId ? { department_id: input.departmentId } : {}),
    require_valid_certificates: input.requireValidCertificates,
    include_ineligible: input.includeIneligible,
  };
}

/**
 * The booking a candidate is allocated with: the window and the hours of the search, on the chosen project and WBS,
 * with the skills of the search so lapsed skills and certificates come back as warnings.
 */
export function buildCandidateAllocation(
  candidate: Pick<ResourceCandidate, 'employee_id'>,
  search: CandidateSearchPayload,
  bookingType: BookingType,
  projectId: string,
  wbsNodeId: string | null,
): AllocationPayload {
  return {
    employee_id: candidate.employee_id,
    project_id: projectId,
    ...(wbsNodeId ? { wbs_node_id: wbsNodeId } : {}),
    booking_type: bookingType,
    start_date: search.start_date,
    end_date: search.end_date,
    allocated_hours_per_day: search.allocated_hours_per_day,
    ...(search.requirements.length > 0
      ? { required_skill_ids: search.requirements.map((requirement) => requirement.skill_id) }
      : {}),
  };
}

// --- Errors ---

/** The rules a refused change violated: the `invalid_params` of the 422 problem details. */
export function problemIssues(error: unknown): PlanningIssue[] {
  const body =
    error instanceof HttpErrorResponse
      ? (error.error as Partial<ResourcePlanningProblem> | null)
      : null;
  return Array.isArray(body?.invalid_params) ? body.invalid_params : [];
}

export function problemDetail(error: unknown): string | null {
  const body =
    error instanceof HttpErrorResponse
      ? (error.error as Partial<ResourcePlanningProblem & { message: string }> | null)
      : null;
  return body?.detail ?? body?.message ?? null;
}

/** Placeholders of an issue for the translation pipe. */
export function issueParams(issue: {
  params?: Record<string, string | number | boolean | null>;
}): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(issue.params ?? {})) {
    params[key] = value === null ? '' : typeof value === 'boolean' ? String(value) : value;
  }
  return params;
}

export function errorKey(code: string): string {
  return `resourcePlanning.error.${code}`;
}

export function warningKey(code: string): string {
  return `resourcePlanning.warning.${code}`;
}

export function blockerKey(code: string): string {
  return `resourcePlanning.blocker.${code}`;
}

// --- Skills ---

/** Tag colour of a proficiency level: the higher, the greener. */
export function levelColor(level: number): string {
  return level >= 5 ? 'green' : level >= 4 ? 'cyan' : level >= 3 ? 'blue' : level >= 2 ? 'gold' : 'default';
}

export function certificationColor(status: CertificationStatus): string {
  return status === 'valid' ? 'green' : status === 'not_required' ? 'default' : 'red';
}

/** A skill code is needed only when the skill requires a certificate. */
export function skillPayload(input: {
  category: string;
  skillName: string;
  requiresCertification: boolean;
  certificationCode: string;
}): SkillPayload | null {
  const category = input.category.trim();
  const skillName = input.skillName.trim();
  const code = input.certificationCode.trim();
  if (category === '' || skillName === '' || (input.requiresCertification && code === '')) {
    return null;
  }
  return {
    category,
    skill_name: skillName,
    requires_certification: input.requiresCertification,
    certification_code: input.requiresCertification ? code : null,
  };
}

// --- Utilization ---

export function utilizationStatusColor(status: UtilizationStatus): 'green' | 'orange' | 'blue' {
  return status === 'on_target' ? 'green' : status === 'below_target' ? 'orange' : 'blue';
}

/** `on_target` inside plus or minus five points around the target, as the API states it. */
export function utilizationStatusOf(gapPercent: number): UtilizationStatus {
  if (Math.abs(gapPercent) <= 5) {
    return 'on_target';
  }
  return gapPercent < 0 ? 'below_target' : 'above_target';
}
