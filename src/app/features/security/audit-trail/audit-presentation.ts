import { AuditEventType } from '@core';

/** Event types that the explorer groups under the SECURITY badge: authentication, permissions and the trail's own upkeep. */
const SECURITY_EVENTS: readonly AuditEventType[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'PERMISSION_CHANGED',
  'WORM_SEALED',
  'AUDIT_LOG_INSPECTED',
];

export function isSecurityEvent(event: AuditEventType): boolean {
  return SECURITY_EVENTS.includes(event);
}

/** NG-ZORRO tag color of an event badge. */
export function eventColor(event: AuditEventType): string {
  switch (event) {
    case 'CREATED':
      return 'green';
    case 'UPDATED':
      return 'blue';
    case 'DELETED':
      return 'red';
    case 'RESTORED':
      return 'cyan';
    case 'VIEWED':
      return 'geekblue';
    case 'EXPORTED':
      return 'purple';
    case 'LOGIN_FAILED':
      return 'volcano';
    default:
      return 'magenta';
  }
}

export function eventLabelKey(event: AuditEventType): string {
  return `AUDIT.EVENT.${event}`;
}

/** "2027-12-11T09:30:12.123456Z" shown with its microseconds, in UTC. */
export function formatMicroTimestamp(value: string): string {
  return value.replace('T', ' ').replace('Z', '');
}

/** A short form of a SHA-256 digest for table cells: the first and last characters. */
export function shortHash(hash: string | null | undefined, edge = 8): string {
  if (!hash) {
    return '';
  }
  return hash.length <= edge * 2 + 1 ? hash : `${hash.slice(0, edge)}…${hash.slice(-edge)}`;
}
