import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GeneralLedgerApiService,
  GeneralLedgerPrimaNotaApiService,
  PermissionsService,
} from '@core';
import { GlYearEndClosingComponent } from './gl-year-end-closing.component';
import { YearEndClosingStore } from './gl-year-end-closing.store';

const stages = [
  {
    stage: 1,
    key: 'period_lock',
    status: 'completed',
    summary: { periods_locked: 12 },
    journal_entry_id: null,
    executed_at: '2026-12-31T10:00:00Z',
  },
  {
    stage: 2,
    key: 'net_result',
    status: 'ready',
    summary: null,
    journal_entry_id: null,
    executed_at: null,
  },
  {
    stage: 3,
    key: 'closing',
    status: 'blocked',
    summary: null,
    journal_entry_id: null,
    executed_at: null,
  },
  {
    stage: 4,
    key: 'opening',
    status: 'blocked',
    summary: null,
    journal_entry_id: null,
    executed_at: null,
  },
];

describe('GlYearEndClosingComponent', () => {
  const api = { getClosingWorkflow: vi.fn(), runClosingStage: vi.fn() };
  const glApi = { getFiscalYears: vi.fn() };
  let fixture: ComponentFixture<GlYearEndClosingComponent>;
  let store: InstanceType<typeof YearEndClosingStore>;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    glApi.getFiscalYears.mockReturnValue(
      of({
        success: true,
        message: '',
        data: [{ id: 'y1', year_code: '2026', start_date: '2026-01-01', end_date: '2026-12-31' }],
      }),
    );
    api.getClosingWorkflow.mockReturnValue(
      of({
        success: true,
        message: '',
        data: {
          fiscal_year_id: 'y1',
          year_code: '2026',
          year_status: 'open',
          ledger: '01',
          stages,
          next_stage: 2,
          is_complete: false,
        },
      }),
    );
    api.runClosingStage.mockReturnValue(
      of({ success: true, message: '', data: { already_completed: false, stage: stages[1] } }),
    );
    await TestBed.configureTestingModule({
      imports: [GlYearEndClosingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GeneralLedgerPrimaNotaApiService, useValue: api },
        { provide: GeneralLedgerApiService, useValue: glApi },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GlYearEndClosingComponent);
    store = fixture.debugElement.injector.get(YearEndClosingStore);
    fixture.detectChanges();
    await store.selectYear('y1');
    fixture.detectChanges();
  });

  it('shows the four stages with their status and the summary of the completed one', () => {
    const cards = fixture.nativeElement.querySelectorAll('[data-stage]');
    expect(cards.length).toBe(4);
    expect(cards[0].textContent).toContain('periods_locked: 12');
  });

  it('offers the run button on the ready stage only', () => {
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="yec-run"]');
    expect(buttons.length).toBe(1);
    expect(
      fixture.nativeElement.querySelector('[data-stage="2"] [data-testid="yec-run"]'),
    ).not.toBeNull();
  });

  it('asks for a confirmation before running a stage and runs it for the book', async () => {
    fixture.nativeElement.querySelector('[data-testid="yec-run"]').click();
    expect(store.pendingStage()).toBe(2);
    expect(api.runClosingStage).not.toHaveBeenCalled();

    await store.confirmStage();
    expect(api.runClosingStage).toHaveBeenCalledWith('y1', 2, '01');
  });
});
