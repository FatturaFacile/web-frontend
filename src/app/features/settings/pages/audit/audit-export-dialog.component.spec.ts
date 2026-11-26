import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditExport, AuditLedgerApiService, TranslateService } from '@core';
import { AuditExportDialogComponent } from './audit-export-dialog.component';

const job = (status: AuditExport['status'], overrides: Partial<AuditExport> = {}): AuditExport => ({
  id: 'x1',
  status,
  from: '2026-01-01',
  to: '2026-06-30',
  filters: {},
  entries_count: null,
  from_sequence: null,
  to_sequence: null,
  start_hash: null,
  end_hash: null,
  verification_outcome: null,
  sha256: null,
  signature: null,
  error: null,
  created_at: '2026-11-26T10:00:00Z',
  completed_at: null,
  download_url: null,
  ...overrides,
});

const ok = <T>(data: T) => of({ success: true, message: '', data });

interface DialogInternals {
  range: { set(value: Date[]): void };
  current(): AuditExport | null;
  canSubmit(): boolean;
  tooLong(): boolean;
  requestError(): string | null;
  submit(): void;
  close(): void;
}

describe('AuditExportDialogComponent', () => {
  const api = { requestExport: vi.fn(), getExport: vi.fn(), downloadExport: vi.fn() };

  function setup() {
    const fixture = TestBed.createComponent(AuditExportDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return { fixture, dialog: fixture.componentInstance as unknown as DialogInternals };
  }

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [
        { provide: AuditLedgerApiService, useValue: api },
        {
          provide: TranslateService,
          useValue: {
            currentLanguage: signal('en'),
            translate: (key: string) => key,
            instant: (key: string) => key,
          },
        },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('cannot submit without a range or with a window over 366 days', () => {
    const { dialog } = setup();
    expect(dialog.canSubmit()).toBe(false);

    dialog.range.set([new Date(2024, 0, 1), new Date(2026, 0, 1)]);
    expect(dialog.tooLong()).toBe(true);
    expect(dialog.canSubmit()).toBe(false);

    dialog.range.set([new Date(2026, 0, 1), new Date(2026, 5, 30)]);
    expect(dialog.canSubmit()).toBe(true);
  });

  it('requests the export with an idempotency key and follows it until it is completed', async () => {
    api.requestExport.mockReturnValue(ok(job('queued')));
    api.getExport.mockReturnValue(
      ok(job('completed', { entries_count: 120, sha256: 'abc', verification_outcome: 'valid' })),
    );
    const { fixture, dialog } = setup();
    dialog.range.set([new Date(2026, 0, 1), new Date(2026, 5, 30)]);

    dialog.submit();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const [request, key] = api.requestExport.mock.calls[0];
    expect(request).toEqual({ from: '2026-01-01', to: '2026-06-30' });
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(10);
    expect(api.getExport).toHaveBeenCalledWith('x1');
    expect(dialog.current()?.status).toBe('completed');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('audit.export.status.completed');
  });

  it('keeps polling while the export is running', async () => {
    vi.useFakeTimers();
    api.requestExport.mockReturnValue(ok(job('queued')));
    api.getExport.mockReturnValue(ok(job('running')));
    const { fixture, dialog } = setup();
    dialog.range.set([new Date(2026, 0, 1), new Date(2026, 5, 30)]);

    dialog.submit();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    const first = api.getExport.mock.calls.length;

    await vi.advanceTimersByTimeAsync(2100);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.getExport.mock.calls.length).toBeGreaterThan(first);
  });

  it('answers a window refused by the API (422) with the range message', async () => {
    api.requestExport.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    const { fixture, dialog } = setup();
    dialog.range.set([new Date(2026, 0, 1), new Date(2026, 5, 30)]);

    dialog.submit();
    await fixture.whenStable();

    expect(dialog.requestError()).toBe('audit.export.error_range');
    expect(dialog.current()).toBeNull();
  });

  it('reports a refusal of the role', async () => {
    api.requestExport.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const { fixture, dialog } = setup();
    dialog.range.set([new Date(2026, 0, 1), new Date(2026, 5, 30)]);

    dialog.submit();
    await fixture.whenStable();

    expect(dialog.requestError()).toBe('settings.audit.error.forbidden');
  });

  it('forgets the export when the dialog closes', async () => {
    api.requestExport.mockReturnValue(ok(job('completed', { entries_count: 1 })));
    api.getExport.mockReturnValue(ok(job('completed', { entries_count: 1 })));
    const { fixture, dialog } = setup();
    dialog.range.set([new Date(2026, 0, 1), new Date(2026, 5, 30)]);
    dialog.submit();
    await fixture.whenStable();

    dialog.close();

    expect(dialog.current()).toBeNull();
    expect(dialog.canSubmit()).toBe(false);
  });
});
