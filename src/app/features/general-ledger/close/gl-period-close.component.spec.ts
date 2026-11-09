import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingApiService, CloseChecklist, GeneralLedgerApiService, PermissionsService } from '@core';
import { GlPeriodCloseComponent } from './gl-period-close.component';

const checklist: CloseChecklist = {
  fiscal_period_id: 'p1',
  period_name: '2026-11',
  status: 'open',
  can_close: false,
  checks: [{ code: 'no_drafts', label: 'No drafts', blocking: true, passed: false, count: 2 }],
  tasks: [],
};

describe('GlPeriodCloseComponent', () => {
  const api = { getFiscalYears: vi.fn(), getCloseChecklist: vi.fn(), addCloseTask: vi.fn(), setCloseTaskStatus: vi.fn() };
  const accountingApi = { closeFiscalPeriod: vi.fn(), reopenFiscalPeriod: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getFiscalYears.mockReturnValue(
      of({ data: [{ id: 'y1', year_code: '2026', periods: [{ id: 'p1', period_name: '2026-11', status: 'open' }] }] }),
    );
    api.getCloseChecklist.mockReturnValue(of({ success: true, message: '', data: checklist }));
    await TestBed.configureTestingModule({
      imports: [GlPeriodCloseComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GeneralLedgerApiService, useValue: api },
        { provide: AccountingApiService, useValue: accountingApi },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
  });

  interface Internals {
    selectPeriod(id: string): void;
    closePeriod(): void;
    blockingMessage(): string | null;
  }

  it('loads the checklist of the selected period', () => {
    const fixture = TestBed.createComponent(GlPeriodCloseComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as Internals).selectPeriod('p1');
    expect(api.getCloseChecklist).toHaveBeenCalledWith('p1');
  });

  it('shows the blocking items when closing the period answers 409', () => {
    accountingApi.closeFiscalPeriod.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'No drafts (2).' } })),
    );
    const fixture = TestBed.createComponent(GlPeriodCloseComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Internals;
    component.selectPeriod('p1');
    component.closePeriod();
    expect(component.blockingMessage()).toBe('No drafts (2).');
    expect(api.getCloseChecklist).toHaveBeenCalledTimes(2);
  });
});
