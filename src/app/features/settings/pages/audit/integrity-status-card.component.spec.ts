import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditIntegrity, AuditLedgerApiService, TranslateService } from '@core';
import { IntegrityStatusCardComponent } from './integrity-status-card.component';

const state = (overrides: Partial<AuditIntegrity> = {}): AuditIntegrity => ({
  status: 'valid',
  tail: { sequence: 42, hash: 'deadbeef' },
  running_run_id: null,
  last_run: {
    id: 'r1',
    trigger: 'schedule',
    status: 'completed',
    outcome: 'valid',
    broken_at_sequence: null,
    missing_range: null,
    verified_entries: 42,
    started_at: '2026-11-26T02:45:00Z',
    finished_at: '2026-11-26T02:45:03Z',
  },
  last_checkpoint: null,
  ...overrides,
});

const ok = <T>(data: T) => of({ success: true, message: '', data });

describe('IntegrityStatusCardComponent', () => {
  const api = { integrity: vi.fn(), verify: vi.fn() };

  async function render(): Promise<ComponentFixture<IntegrityStatusCardComponent>> {
    const fixture = TestBed.createComponent(IntegrityStatusCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const element = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

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

  it('shows a valid chain with its last run and tail, without an alert', async () => {
    api.integrity.mockReturnValue(ok(state()));

    const fixture = await render();

    expect(element(fixture).textContent).toContain('audit.integrity.status.valid');
    expect(element(fixture).textContent).toContain('#42');
    expect(element(fixture).querySelector('nz-alert.broken')).toBeNull();
  });

  it('raises a prominent alert for a chain broken at a sequence', async () => {
    api.integrity.mockReturnValue(
      ok(
        state({
          status: 'broken_at',
          last_run: { ...state().last_run!, outcome: 'broken_at', broken_at_sequence: 17 },
        }),
      ),
    );

    const fixture = await render();

    const alert = element(fixture).querySelector('nz-alert.broken');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('audit.integrity.broken_title');
    expect(alert?.textContent).toContain('#17');
  });

  it('raises the alert for a missing range too', async () => {
    api.integrity.mockReturnValue(
      ok(
        state({
          status: 'missing_range',
          last_run: { ...state().last_run!, outcome: 'missing_range', missing_range: { from: 5, to: 9 } },
        }),
      ),
    );

    const fixture = await render();

    expect(element(fixture).querySelector('nz-alert.broken')?.textContent).toContain('#5');
  });

  it('shows an error, not a made up status, when the API fails', async () => {
    api.integrity.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    const fixture = await render();

    expect(element(fixture).textContent).toContain('audit.integrity.error');
    expect(element(fixture).textContent).not.toContain('audit.integrity.status.valid');
  });

  it('queues a verification and reloads the status', async () => {
    api.integrity.mockReturnValue(ok(state({ status: 'never_verified', last_run: null })));
    api.verify.mockReturnValue(ok({ id: 'r2', status: 'queued' }));
    const fixture = await render();

    fixture.componentInstance.verify();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.verify).toHaveBeenCalledTimes(1);
    expect(api.integrity.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fixture.componentInstance.notice()).toBe('audit.integrity.queued');
  });

  it('explains a 409 (a verification is already running) instead of failing', async () => {
    api.integrity.mockReturnValue(ok(state()));
    api.verify.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const fixture = await render();

    fixture.componentInstance.verify();
    await fixture.whenStable();

    expect(fixture.componentInstance.notice()).toBe('audit.integrity.already_running');
    expect(fixture.componentInstance.verifying()).toBe(false);
  });
});
