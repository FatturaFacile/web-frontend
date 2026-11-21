import { AuditEventType, AuditLogEntry, AuditLogFilters } from '@core';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export const AUDIT_SEVERITIES: readonly AuditSeverity[] = ['info', 'warning', 'critical'];

/** The ledger has no severity column: it is derived from the action. */
export function auditSeverity(event: AuditEventType): AuditSeverity {
  switch (event) {
    case 'DELETED':
    case 'PERMISSION_CHANGED':
      return 'critical';
    case 'LOGIN_FAILED':
    case 'EXPORTED':
    case 'RESTORED':
    case 'AUDIT_LOG_INSPECTED':
      return 'warning';
    default:
      return 'info';
  }
}

export function severityTagColor(severity: AuditSeverity): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    default:
      return 'blue';
  }
}

export interface AuditExplorerCriteria {
  range: readonly Date[];
  actions: readonly AuditEventType[];
  actorId: string;
  entityType: string;
  entityId: string;
}

/** Query of the ledger endpoint for the criteria: empty criteria are left out. */
export function buildAuditFilters(criteria: AuditExplorerCriteria): AuditLogFilters {
  const filters: AuditLogFilters = {};
  if (criteria.range.length === 2) {
    filters.date_from = criteria.range[0].toISOString();
    filters.date_to = criteria.range[1].toISOString();
  }
  if (criteria.actions.length > 0) {
    filters.event_type = [...criteria.actions];
  }
  if (criteria.actorId.trim() !== '') {
    filters.actor_id = criteria.actorId.trim();
  }
  if (criteria.entityType.trim() !== '') {
    filters.auditable_type = criteria.entityType.trim();
  }
  if (criteria.entityId.trim() !== '') {
    filters.auditable_id = criteria.entityId.trim();
  }
  return filters;
}

/** Severity has no server filter, so it narrows the page already loaded. */
export function filterBySeverity(
  rows: readonly AuditLogEntry[],
  severities: readonly AuditSeverity[],
): AuditLogEntry[] {
  return severities.length === 0
    ? [...rows]
    : rows.filter((row) => severities.includes(auditSeverity(row.event_type)));
}
