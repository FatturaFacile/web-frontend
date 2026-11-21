import { ShiftSwapRequest } from '@core';

export interface IcsShift {
  id: string;
  start_at: string;
  end_at: string;
  summary: string;
}

/** `20260302T060000Z`: an instant in the UTC form RFC 5545 expects. */
export function toIcsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 characters continue on the next line after a space (RFC 5545, 3.1). */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

/** The own shifts as an iCalendar file that Google Calendar, Outlook and Apple Calendar import. */
export function buildIcs(shifts: readonly IcsShift[], now: Date = new Date()): string {
  const stamp = toIcsDate(now.toISOString());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FatturaFacile//Shift planning//EN'];
  for (const shift of shifts) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${shift.id}@fatturafacile`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsDate(shift.start_at)}`,
      `DTEND:${toIcsDate(shift.end_at)}`,
      `SUMMARY:${escapeIcsText(shift.summary)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** Items grouped by `shift_date`, days in order. */
export function groupByDate<T extends { shift_date: string }>(
  items: readonly T[],
): [string, T[]][] {
  const days = new Map<string, T[]>();
  for (const item of items) {
    const day = days.get(item.shift_date) ?? [];
    day.push(item);
    days.set(item.shift_date, day);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export type SwapRole = 'outgoing' | 'incoming' | 'broadcast';

/** Whether the swap was requested by the employee, offered to the employee or is an open broadcast. */
export function swapRole(swap: ShiftSwapRequest, employeeId: string | null): SwapRole {
  if (employeeId !== null && swap.requester_employee_id === employeeId) {
    return 'outgoing';
  }
  return swap.is_broadcast ? 'broadcast' : 'incoming';
}

/** The colleague answers while the swap waits for the peer. */
export function canRespond(swap: ShiftSwapRequest, employeeId: string | null): boolean {
  return swap.status === 'pending_peer_acceptance' && swapRole(swap, employeeId) !== 'outgoing';
}

/** `HH:mm` of an instant in the time zone of the employee's device. */
export function localClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
