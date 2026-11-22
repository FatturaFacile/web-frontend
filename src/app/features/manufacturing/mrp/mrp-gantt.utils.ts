import { MrpGanttBlock, MrpGanttBucket, MrpGanttWorkCenter } from './mrp.models';

/** Pure layout math of the finite-capacity Gantt: dates to pixels, load percentages, overload detection. */

export const MS_PER_DAY = 86_400_000;
/** A bucket whose load is strictly above this percentage is overloaded. */
export const OVERLOAD_THRESHOLD = 100;
/** Loads above this percentage are drawn at full height of the histogram. */
export const HISTOGRAM_CEILING = 150;

export type GanttZoom = 'day' | 'week';
export const DAY_WIDTH: Record<GanttZoom, number> = { day: 40, week: 14 };

/** `YYYY-MM-DD` as a UTC day number (days since 1970-01-01), so DST never shifts a date. */
export function dayNumber(date: string): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);

  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function dateFromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return dateFromDayNumber(dayNumber(date) + days);
}

/** Days from `from` to `to`, both included. */
export function daySpan(from: string, to: string): number {
  return Math.max(0, dayNumber(to) - dayNumber(from) + 1);
}

/** Every date of the window, in order. */
export function windowDays(from: string, to: string): string[] {
  const start = dayNumber(from);

  return Array.from({ length: daySpan(from, to) }, (_, index) => dateFromDayNumber(start + index));
}

/** Left edge in pixels of a date inside the window. */
export function dateToX(date: string, from: string, dayWidth: number): number {
  return (dayNumber(date) - dayNumber(from)) * dayWidth;
}

/** The date under a pixel offset of the timeline (offsets before the window give earlier dates). */
export function xToDate(x: number, from: string, dayWidth: number): string {
  return dateFromDayNumber(dayNumber(from) + Math.floor(x / dayWidth));
}

export interface BlockRect {
  left: number;
  width: number;
}

/** Position of a block: it covers its first and last day entirely, and is clipped to the window. */
export function blockRect(
  block: Pick<MrpGanttBlock, 'start_date' | 'end_date'>,
  from: string,
  to: string,
  dayWidth: number,
): BlockRect {
  const first = Math.max(dayNumber(block.start_date), dayNumber(from));
  const last = Math.min(dayNumber(block.end_date), dayNumber(to));
  const days = Math.max(1, last - first + 1);

  return { left: (first - dayNumber(from)) * dayWidth, width: days * dayWidth };
}

/** Stacks overlapping blocks on separate rows (greedy, first row that is free); returns the row of every block id. */
export function layoutRows(blocks: MrpGanttBlock[]): {
  rows: Record<string, number>;
  rowCount: number;
} {
  const ordered = [...blocks].sort(
    (a, b) => dayNumber(a.start_date) - dayNumber(b.start_date) || a.id.localeCompare(b.id),
  );
  const rowEnds: number[] = [];
  const rows: Record<string, number> = {};

  for (const block of ordered) {
    const start = dayNumber(block.start_date);
    let row = rowEnds.findIndex((end) => end < start);

    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowEnds[row] = dayNumber(block.end_date);
    rows[block.id] = row;
  }

  return { rows, rowCount: Math.max(1, rowEnds.length) };
}

/** Load percentage from minutes; a bucket without capacity but with load counts as overloaded (reported as 999). */
export function loadPercentage(loaded: number, available: number): number {
  if (available <= 0) {
    return loaded > 0 ? 999 : 0;
  }

  return Math.round((loaded / available) * 10_000) / 100;
}

/** The percentage of a bucket: the server value when it is a number, the computed one otherwise. */
export function bucketPercentage(bucket: MrpGanttBucket): number {
  const served = Number(bucket.load_percentage);

  return Number.isFinite(served)
    ? served
    : loadPercentage(bucket.loaded_minutes, bucket.available_minutes);
}

/** Overloaded means strictly above 100 %, whatever the server flag says about rounding. */
export function isOverloaded(bucket: MrpGanttBucket): boolean {
  return bucketPercentage(bucket) > OVERLOAD_THRESHOLD;
}

export type BucketLevel = 'overload' | 'high' | 'ok' | 'idle';

export function bucketLevel(bucket: MrpGanttBucket): BucketLevel {
  const percentage = bucketPercentage(bucket);

  if (percentage > OVERLOAD_THRESHOLD) {
    return 'overload';
  }
  if (percentage >= 80) {
    return 'high';
  }

  return percentage > 0 ? 'ok' : 'idle';
}

/** CSS class of a bucket cell: red for overload. */
export function bucketClass(bucket: MrpGanttBucket): string {
  return `bucket--${bucketLevel(bucket)}`;
}

/** Height of a bucket cell as a share (0..1) of the histogram. */
export function bucketHeight(bucket: MrpGanttBucket): number {
  return Math.min(1, bucketPercentage(bucket) / HISTOGRAM_CEILING);
}

export function overloadedBuckets(workCenter: MrpGanttWorkCenter): MrpGanttBucket[] {
  return workCenter.buckets.filter(isOverloaded);
}

export function maxLoad(workCenter: MrpGanttWorkCenter): number {
  return workCenter.buckets.reduce((max, bucket) => Math.max(max, bucketPercentage(bucket)), 0);
}

/** Buckets of one work centre grouped by date, in shift order. */
export function bucketsByDate(workCenter: MrpGanttWorkCenter): Record<string, MrpGanttBucket[]> {
  const grouped: Record<string, MrpGanttBucket[]> = {};

  for (const bucket of workCenter.buckets) {
    (grouped[bucket.bucket_date] ??= []).push(bucket);
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => (a.shift_code ?? '').localeCompare(b.shift_code ?? ''));
  }

  return grouped;
}

export interface DroppedRange {
  start_date: string;
  end_date: string;
}

/**
 * The dates a block takes when dropped: `pointerX` is the drop position relative to the lane, `grabOffsetPx` the distance
 * between the left edge of the block and the point where it was grabbed. The block keeps its span in days.
 */
export function droppedRange(
  block: Pick<MrpGanttBlock, 'start_date' | 'end_date'>,
  pointerX: number,
  grabOffsetPx: number,
  from: string,
  dayWidth: number,
): DroppedRange {
  const span = Math.max(0, dayNumber(block.end_date) - dayNumber(block.start_date));
  const start = xToDate(pointerX - grabOffsetPx + dayWidth / 2, from, dayWidth);

  return { start_date: start, end_date: addDays(start, span) };
}

/** The alternatives of a work centre, in the order of the lanes. */
export function alternativeWorkCenters(
  workCenters: MrpGanttWorkCenter[],
  workCenterId: string,
): MrpGanttWorkCenter[] {
  const current = workCenters.find((workCenter) => workCenter.id === workCenterId);
  const allowed = new Set(current?.alternative_work_center_ids ?? []);

  return workCenters.filter((workCenter) => allowed.has(workCenter.id));
}

/** Default window of the Gantt: today plus four weeks (a Monday-agnostic, 28-day window). */
export function defaultWindow(today: Date = new Date()): { from: string; to: string } {
  const from = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    .toISOString()
    .slice(0, 10);

  return { from, to: addDays(from, 27) };
}

/** A local calendar date as `YYYY-MM-DD` (what the date pickers hand out), without any timezone shift. */
export function formatIsoDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
