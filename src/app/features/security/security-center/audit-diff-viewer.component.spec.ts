import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuditLogEntry } from '@core';
import { AuditDiffViewerComponent } from './audit-diff-viewer.component';
import { auditSeverity, buildAuditFilters, filterBySeverity } from './audit-explorer.helpers';

function render(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
) {
  const fixture = TestBed.createComponent(AuditDiffViewerComponent);
  fixture.componentRef.setInput('oldValues', oldValues);
  fixture.componentRef.setInput('newValues', newValues);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AuditDiffViewerComponent', () => {
  it('renders old and new values side by side and marks the kind of each row', () => {
    const element = render(
      { status: 'unpaid', iban: 'CH93 **** 2957', gone: 1 },
      { status: 'paid', iban: 'CH93 **** 2957', fresh: { a: 1 } },
    );

    const kinds = Array.from(element.querySelectorAll('tbody tr')).map((row) => [
      row.querySelector('th')?.textContent?.trim(),
      row.getAttribute('data-kind'),
    ]);
    expect(kinds).toEqual([
      ['fresh', 'added'],
      ['gone', 'removed'],
      ['iban', 'unchanged'],
      ['status', 'modified'],
    ]);

    const status = element.querySelector('tr[data-kind="modified"]')!;
    expect(status.querySelector('td.before')?.textContent).toBe('unpaid');
    expect(status.querySelector('td.after')?.textContent).toBe('paid');
    expect(element.querySelector('tr[data-kind="added"] td.after')?.textContent).toBe('{"a":1}');
  });

  it('shows an empty message when the record carries no values', () => {
    const element = render(null, null);
    expect(element.querySelector('[data-testid="diff-table"]')).toBeNull();
    expect(element.querySelector('[data-testid="diff-empty"]')).not.toBeNull();
  });
});

describe('audit explorer helpers', () => {
  const entry = (id: string, event_type: AuditLogEntry['event_type']): AuditLogEntry =>
    ({ id, event_type }) as AuditLogEntry;

  it('derives the severity from the action', () => {
    expect(auditSeverity('DELETED')).toBe('critical');
    expect(auditSeverity('LOGIN_FAILED')).toBe('warning');
    expect(auditSeverity('VIEWED')).toBe('info');
  });

  it('narrows rows by severity and keeps all of them without a selection', () => {
    const rows = [entry('1', 'DELETED'), entry('2', 'VIEWED'), entry('3', 'EXPORTED')];
    expect(filterBySeverity(rows, []).map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(filterBySeverity(rows, ['critical', 'warning']).map((r) => r.id)).toEqual(['1', '3']);
  });

  it('builds the ledger query from the criteria and leaves empty ones out', () => {
    const from = new Date('2027-01-01T00:00:00Z');
    const to = new Date('2027-01-31T00:00:00Z');
    expect(
      buildAuditFilters({
        range: [from, to],
        actions: ['UPDATED'],
        actorId: ' u-1 ',
        entityType: 'Invoice',
        entityId: '',
      }),
    ).toEqual({
      date_from: from.toISOString(),
      date_to: to.toISOString(),
      event_type: ['UPDATED'],
      actor_id: 'u-1',
      auditable_type: 'Invoice',
    });
    expect(
      buildAuditFilters({ range: [], actions: [], actorId: '', entityType: '', entityId: '' }),
    ).toEqual({});
  });
});
