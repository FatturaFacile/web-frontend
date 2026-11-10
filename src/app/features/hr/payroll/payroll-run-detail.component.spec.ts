import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { PayrollApiService } from '@core';
import { PayrollRunDetailComponent } from './payroll-run-detail.component';

function run(status: string) {
  return {
    success: true,
    message: '',
    data: {
      id: 'r1',
      year: 2026,
      month: 10,
      country: 'CH',
      currency: 'CHF',
      status,
      payment_date: null,
      calculated_at: '2026-10-25T10:00:00Z',
      approved_at: null,
      approved_by: null,
      finalized_at: null,
      finalized_by: null,
      reopened_at: null,
      reopened_by: null,
      reopen_reason: null,
      reopen_count: 0,
      payslips: [],
      events: [],
    },
  };
}

describe('PayrollRunDetailComponent', () => {
  let fixture: ComponentFixture<PayrollRunDetailComponent>;
  const api = {
    getRun: vi.fn(),
    approveRun: vi.fn(),
    finalizeRun: vi.fn(),
    reopenRun: vi.fn(),
    getCostAllocation: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup(status: string, canWrite = true): void {
    api.getRun.mockReturnValue(of(run(status)));
    TestBed.configureTestingModule({
      providers: [
        { provide: PayrollApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
    fixture = TestBed.createComponent(PayrollRunDetailComponent);
    fixture.componentRef.setInput('runId', 'r1');
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.detectChanges();
  }

  /** The texts come from the API; without a dictionary a button shows its translation key. */
  function buttons(): string {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) => (b as HTMLElement).textContent).join('|');
  }

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    message.success.mockReset();
    message.error.mockReset();
    TestBed.resetTestingModule();
  });

  it('offers approve only on a calculated run', async () => {
    setup('Calculated');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(buttons()).toContain('hrmPayroll.approve');
    expect(buttons()).not.toContain('hrmPayroll.finalize');
  });

  it('offers finalize and reopen only on an approved run', async () => {
    setup('Approved');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(buttons()).toContain('hrmPayroll.finalize');
    expect(buttons()).toContain('hrmPayroll.reopen');
    expect(buttons()).not.toContain('hrmPayroll.approve');
  });

  it('hides every transition without write permission', async () => {
    setup('Calculated', false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(buttons()).not.toContain('hrmPayroll.approve');
  });

  it('approves and reloads the run, showing the server error on 409', async () => {
    setup('Calculated');
    await fixture.whenStable();
    api.approveRun.mockReturnValue(of(run('Approved')));
    api.getRun.mockReturnValue(of(run('Approved')));
    (fixture.componentInstance as unknown as { approve(): void }).approve();
    expect(api.approveRun).toHaveBeenCalledWith('r1');
    expect(message.success).toHaveBeenCalled();

    api.finalizeRun.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Run is locked' } })),
    );
    (fixture.componentInstance as unknown as { transition(r: unknown, k: string): void }).transition(
      api.finalizeRun('r1'),
      'x',
    );
    expect(message.error).toHaveBeenCalledWith('Run is locked');
  });
});
