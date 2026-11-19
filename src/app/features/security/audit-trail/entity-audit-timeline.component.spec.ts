import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuditLogEntry, AuditTrailApiService, PermissionsService } from '@core';
import { EntityAuditTimelineComponent } from './entity-audit-timeline.component';

function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: 'log-1',
    sequence_number: 1,
    event_type: 'CREATED',
    auditable_type: 'Invoice',
    auditable_id: 'inv-1',
    actor: { type: 'USER', id: 'u1', email: 'auditor@example.test', role: 'owner' },
    ip_address: '10.0.0.1',
    route_name: null,
    request_id: null,
    changed_fields: [],
    context_metadata: null,
    occurred_at: '2027-12-11T09:30:12.123456Z',
    worm_sealed: false,
    has_payload: true,
    ...overrides,
  };
}

function setup(allowed: boolean) {
  const entityTimeline = vi.fn(() =>
    of({
      success: true,
      message: '',
      data: [
        entry({}),
        entry({
          id: 'log-2',
          sequence_number: 2,
          event_type: 'UPDATED',
          changed_fields: ['payment_status'],
        }),
      ],
    }),
  );

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuditTrailApiService, useValue: { entityTimeline } },
      {
        provide: PermissionsService,
        useValue: { canRead: () => allowed, canWrite: () => allowed },
      },
    ],
  });

  const fixture = TestBed.createComponent(EntityAuditTimelineComponent);
  fixture.componentRef.setInput('entityType', 'Invoice');
  fixture.componentRef.setInput('entityId', 'inv-1');
  fixture.detectChanges();

  return { fixture, entityTimeline };
}

describe('EntityAuditTimelineComponent', () => {
  it('lists the whole lifecycle of the record in order', () => {
    const { fixture, entityTimeline } = setup(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(entityTimeline).toHaveBeenCalledWith('Invoice', 'inv-1');
    expect(fixture.nativeElement.querySelectorAll('nz-timeline-item')).toHaveLength(2);
    expect(text).toContain('auditor@example.test');
    expect(text).toContain('payment_status');
    expect(text).toContain('2027-12-11 09:30:12.123456');
  });

  it('renders nothing and never calls the API for a member who may not read the trail', () => {
    const { fixture, entityTimeline } = setup(false);

    expect(entityTimeline).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
