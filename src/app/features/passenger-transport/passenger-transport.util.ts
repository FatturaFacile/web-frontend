import { HttpErrorResponse } from '@angular/common/http';
import {
  PtrBookingAction,
  PtrBookingStatus,
  PtrComplianceIssue,
  PtrDecimal,
  PtrFlightStatus,
  PtrProblem,
  PtrSheetStatus,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance, dispatchers and operations managers write. */
export const PASSENGER_TRANSPORT_MODULE = 'passenger_transport';

/** Module key of the finance ability: invoicing a booking and the month-end run. */
export const PASSENGER_TRANSPORT_FINANCE_MODULE = 'passenger_transport_finance';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error, the field errors of a 422 and the legal findings of a refused assignment. */
export interface PtrOutcome {
  ok: boolean;
  /** Translation key of the refusal (`passengerTransport.error.<code>`), null on success. */
  errorKey: string | null;
  /** The code of the problem, so a screen can react to a specific refusal. */
  code: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  /** The parameters the API sent with the problem, scalars only (the texts of the dictionary use them). */
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
  /** The legal findings of a refused or unconfirmed assignment (blocking violations or warnings to acknowledge). */
  issues: PtrComplianceIssue[];
}

export const PTR_OK: PtrOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
  issues: [],
};

export function errorKey(code: string | null | undefined): string {
  return `passengerTransport.error.${code ? code : 'generic'}`;
}

/** The problem details of a failed call. */
export function problemOf(error: unknown): PtrProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as PtrProblem) : null;
}

function scalarParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

function issuesOf(problem: PtrProblem | null): PtrComplianceIssue[] {
  const issues = problem?.params?.['issues'];
  return Array.isArray(issues) ? (issues as PtrComplianceIssue[]) : [];
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): PtrOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    code: problem?.code ?? null,
    detail: first ?? problem?.detail ?? null,
    params: scalarParams(problem?.params),
    errors,
    issues: issuesOf(problem),
  };
}

// --- Labels and colours ---

const BOOKING_COLORS: Record<PtrBookingStatus, string> = {
  draft: 'default',
  confirmed: 'blue',
  assigned: 'geekblue',
  en_route_to_pickup: 'cyan',
  at_pickup_waiting: 'gold',
  passenger_on_board: 'purple',
  completed: 'green',
  cancelled: 'red',
  invoiced: 'success',
};

export function bookingStatusColor(status: PtrBookingStatus): string {
  return BOOKING_COLORS[status] ?? 'default';
}

const FLIGHT_COLORS: Record<PtrFlightStatus, string> = {
  scheduled: 'default',
  en_route: 'blue',
  delayed: 'orange',
  landed: 'green',
  cancelled: 'red',
};

export function flightStatusColor(status: PtrFlightStatus | null): string {
  return status === null ? 'default' : (FLIGHT_COLORS[status] ?? 'default');
}

const SHEET_COLORS: Record<PtrSheetStatus, string> = {
  open: 'gold',
  closed: 'blue',
  transmitted: 'green',
};

export function sheetStatusColor(status: PtrSheetStatus): string {
  return SHEET_COLORS[status] ?? 'default';
}

/** The actions a booking offers from its status (the API refuses the others with `booking_transition_refused`). */
export function bookingActions(status: PtrBookingStatus): readonly PtrBookingAction[] {
  switch (status) {
    case 'draft':
      return ['confirm', 'cancel'];
    case 'confirmed':
      return ['cancel'];
    case 'assigned':
      return ['start_run', 'cancel'];
    case 'en_route_to_pickup':
      return ['arrive', 'cancel'];
    case 'at_pickup_waiting':
      return ['board', 'cancel'];
    case 'passenger_on_board':
      return ['complete'];
    default:
      return [];
  }
}

/** Bookings that still accept a driver and a vehicle. */
export function isAssignable(status: PtrBookingStatus): boolean {
  return status === 'draft' || status === 'confirmed' || status === 'assigned';
}

// --- Numbers and durations ---

export function toNumber(value: PtrDecimal | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `270` becomes `4 h 30`, `45` becomes `45 min`. */
export function formatMinutes(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** Compact `4:30` form of a duration, for the gauges. */
export function clockMinutes(minutes: number): string {
  const { hours, minutes: rest } = formatMinutes(minutes);
  return `${hours}:${rest.toString().padStart(2, '0')}`;
}

/** The share of a limit that is used, capped to 0-100; a missing limit counts as 0. */
export function gaugePercent(used: number, limit: number | null): number {
  if (limit === null || limit <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}

/** NG-ZORRO progress status: red above 90 %, orange above 75 %. */
export function gaugeStatus(percent: number): 'success' | 'normal' | 'exception' {
  if (percent >= 90) {
    return 'exception';
  }
  return percent >= 75 ? 'normal' : 'success';
}

export interface KmShares {
  it: number;
  ch: number;
  other: number;
}

/** The share of the kilometres of each territory, in percent (rounded so that the three add up to 100 when there are kilometres). */
export function kmShares(
  it: PtrDecimal | null | undefined,
  ch: PtrDecimal | null | undefined,
  other: PtrDecimal | null | undefined,
): KmShares {
  const itKm = toNumber(it);
  const chKm = toNumber(ch);
  const otherKm = toNumber(other);
  const total = itKm + chKm + otherKm;
  if (total <= 0) {
    return { it: 0, ch: 0, other: 0 };
  }
  const itShare = Math.round((itKm / total) * 100);
  const chShare = Math.round((chKm / total) * 100);
  return { it: itShare, ch: chShare, other: Math.max(0, 100 - itShare - chShare) };
}

// --- Expiry of the documents ---

export type ExpiryState = 'missing' | 'expired' | 'expiring' | 'valid';

/** Days within which a document is shown as expiring. */
export const EXPIRY_WARNING_DAYS = 60;

export function expiryState(
  date: string | null | undefined,
  today: Date = new Date(),
): ExpiryState {
  if (!date) {
    return 'missing';
  }
  const expiry = new Date(`${date.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(expiry.getTime())) {
    return 'missing';
  }
  if (expiry.getTime() < today.getTime()) {
    return 'expired';
  }
  const limit = new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);
  return expiry.getTime() <= limit.getTime() ? 'expiring' : 'valid';
}

const EXPIRY_COLORS: Record<ExpiryState, string> = {
  missing: 'default',
  expired: 'red',
  expiring: 'orange',
  valid: 'green',
};

export function expiryColor(state: ExpiryState): string {
  return EXPIRY_COLORS[state];
}

// --- Dates for the timeline and the forms ---

export interface TimelineSpan {
  /** Left offset in percent of the window. */
  left: number;
  /** Width in percent of the window, at least 1 so that a short trip stays visible. */
  width: number;
}

/** Where a trip sits in the window; null when it does not touch it. */
export function timelineSpan(
  startIso: string,
  endIso: string | null,
  windowStart: Date,
  windowEnd: Date,
): TimelineSpan | null {
  const windowMs = windowEnd.getTime() - windowStart.getTime();
  if (windowMs <= 0) {
    return null;
  }
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : start + 60 * 60_000;
  if (Number.isNaN(start) || end <= windowStart.getTime() || start >= windowEnd.getTime()) {
    return null;
  }
  const from = Math.max(start, windowStart.getTime());
  const to = Math.min(end, windowEnd.getTime());
  return {
    left: ((from - windowStart.getTime()) / windowMs) * 100,
    width: Math.max(1, ((to - from) / windowMs) * 100),
  };
}

/** `2028-03-10` of a date in the local time zone. */
export function toDateString(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `2028-03` of a date in the local time zone. */
export function toPeriod(date: Date): string {
  return toDateString(date).slice(0, 7);
}

/** The API sends instants in ISO 8601; the date-time inputs and the API payloads use `YYYY-MM-DD HH:mm:ss` in the local time zone. */
export function toApiDateTime(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) {
    return null;
  }
  const time = `${`${value.getHours()}`.padStart(2, '0')}:${`${value.getMinutes()}`.padStart(2, '0')}:00`;
  return `${toDateString(value)} ${time}`;
}

export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Opens a downloaded PDF in a new tab (a file download goes through `downloadBlob` of `@shared`). */
export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** `.DDD` file names of the tachograph downloads (driver card, vehicle unit). */
export function isTachographFile(name: string): boolean {
  return /\.(ddd|c1b|v1b|tgd)$/i.test(name);
}
