import { HttpErrorResponse } from '@angular/common/http';

/** First validation message of a Laravel 422 (or its summary message) so the user sees the real reason. */
export function apiErrorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as { message?: unknown; errors?: Record<string, unknown> } | null;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }

  return typeof body?.message === 'string' && body.message !== '' ? body.message : null;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Date as Y-m-d in the browser time zone, the format of the date inputs and of the API dates. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Value of a datetime-local input (`YYYY-MM-DDTHH:mm`) for a date. */
export function toLocalInput(date: Date): string {
  return `${toIsoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The API instant (ISO 8601 in UTC) of a datetime-local input value. */
export function localInputToInstant(value: string): string {
  return new Date(value).toISOString();
}

/** Value of a datetime-local input for an API instant. */
export function instantToLocalInput(instant: string): string {
  return toLocalInput(new Date(instant));
}

/** Next full hour, the default start of a booking. */
export function nextFullHour(from: Date = new Date()): Date {
  const next = new Date(from);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
}

/** Facility managers maintain the register; operators work requests, inspections and meters. Mirrors FacilityPolicy. */
export function facilityAbilities(roles: readonly string[], permissions: readonly string[]): { manage: boolean; operate: boolean } {
  const normalizedRoles = roles.map((role) => role.trim().toLowerCase());
  const granted = new Set(permissions.map((permission) => permission.trim().toLowerCase()));
  const manage = normalizedRoles.some((role) => ['owner', 'admin', 'facility_manager'].includes(role)) || granted.has('facility.manage') || granted.has('facility.*') || granted.has('*');
  const operate = manage || normalizedRoles.some((role) => ['technician', 'service_manager'].includes(role)) || granted.has('facility.operate');

  return { manage, operate };
}

/** Position and width (in percent of the visible window) of an interval in a day timeline. */
export function timelineSlot(startsAt: string, endsAt: string, day: string, fromHour: number, toHour: number): { left: number; width: number } | null {
  const windowStart = new Date(`${day}T${pad(fromHour)}:00`).getTime();
  const windowEnd = new Date(`${day}T${pad(toHour)}:00`).getTime();
  const start = Math.max(new Date(startsAt).getTime(), windowStart);
  const end = Math.min(new Date(endsAt).getTime(), windowEnd);

  if (end <= start) {
    return null;
  }

  const span = windowEnd - windowStart;
  return { left: ((start - windowStart) / span) * 100, width: ((end - start) / span) * 100 };
}
