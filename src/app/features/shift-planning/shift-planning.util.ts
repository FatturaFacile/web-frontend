import { HttpErrorResponse } from '@angular/common/http';
import {
  ComplianceIssue,
  CoverageCell,
  CoverageLevel,
  RosterJurisdiction,
  ShiftAssignment,
  ShiftProblemDetails,
} from '@core';

const TIMEZONES: Readonly<Record<RosterJurisdiction, string>> = {
  CH: 'Europe/Zurich',
  IT: 'Europe/Rome',
};

/** Minutes as `H:MM` (a week of 40 hours is `40:00`). */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
}

/** `HH:mm` of an instant in the local time of the establishment. */
export function formatClock(iso: string, jurisdiction: RosterJurisdiction): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONES[jurisdiction],
  }).format(new Date(iso));
}

/** Time range of a shift card, e.g. `22:00-06:00`. */
export function shiftRange(
  shift: Pick<ShiftAssignment, 'start_at' | 'end_at'>,
  jurisdiction: RosterJurisdiction,
): string {
  return `${formatClock(shift.start_at, jurisdiction)}-${formatClock(shift.end_at, jurisdiction)}`;
}

export function templateLabel(name: Record<string, string>, language: string): string {
  return name[language] ?? name['en'] ?? Object.values(name)[0] ?? '';
}

export function blockingIssues(issues: readonly ComplianceIssue[]): ComplianceIssue[] {
  return issues.filter((issue) => issue.severity === 'blocking_error');
}

export function warningIssues(issues: readonly ComplianceIssue[]): ComplianceIssue[] {
  return issues.filter((issue) => issue.severity === 'warning');
}

/** The compliance findings of a failed call: the `invalid_params` of the 422 problem details. */
export function issuesOfError(error: unknown): ComplianceIssue[] {
  const body =
    error instanceof HttpErrorResponse
      ? (error.error as Partial<ShiftProblemDetails> | null)
      : null;
  return Array.isArray(body?.invalid_params) ? body.invalid_params : [];
}

export function problemDetail(error: unknown): string | null {
  const body =
    error instanceof HttpErrorResponse
      ? (error.error as Partial<ShiftProblemDetails & { message: string }> | null)
      : null;
  return body?.detail ?? body?.message ?? null;
}

const LEVEL_RANK: Readonly<Record<CoverageLevel, number>> = { ok: 0, low: 1, critical: 2 };

/** The worst coverage level of a day and the number of open shifts behind it. */
export function dayCoverage(
  cells: readonly CoverageCell[],
  date: string,
): { level: CoverageLevel; open: number } {
  let level: CoverageLevel = 'ok';
  let open = 0;
  for (const cell of cells) {
    if (cell.date !== date) {
      continue;
    }
    open += cell.open;
    if (LEVEL_RANK[cell.level] > LEVEL_RANK[level]) {
      level = cell.level;
    }
  }
  return { level, open };
}

/** Shifts of a period start on a calendar day: `2026-03-02` is a Monday. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Moves the anchor date of the view by one period. */
export function shiftAnchor(anchor: string, type: 'weekly' | 'monthly', direction: -1 | 1): string {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (type === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7 * direction);
  } else {
    date.setUTCMonth(date.getUTCMonth() + direction, 1);
  }
  return date.toISOString().slice(0, 10);
}

/** First day of the period that contains the anchor: the Monday of the week or the first of the month. */
export function periodStart(anchor: string, type: 'weekly' | 'monthly'): string {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (type === 'weekly') {
    date.setUTCDate(date.getUTCDate() - weekdayIndex(anchor));
  } else {
    date.setUTCDate(1);
  }
  return date.toISOString().slice(0, 10);
}
