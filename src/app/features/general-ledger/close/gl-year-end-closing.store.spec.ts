import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClosingStage,
  ClosingWorkflow,
  GeneralLedgerApiService,
  GeneralLedgerPrimaNotaApiService,
} from '@core';
import { YearEndClosingStore } from './gl-year-end-closing.store';

function stage(number: 1 | 2 | 3 | 4, status: ClosingStage['status']): ClosingStage {
  const keys = ['period_lock', 'net_result', 'closing', 'opening'] as const;
  return {
    stage: number,
    key: keys[number - 1],
    status,
    summary: null,
    journal_entry_id: null,
    executed_at: null,
  };
}

function workflow(statuses: ClosingStage['status'][]): ClosingWorkflow {
  const stages = statuses.map((status, index) => stage((index + 1) as 1 | 2 | 3 | 4, status));
  const next = stages.find((candidate) => candidate.status === 'ready');
  return {
    fiscal_year_id: 'y1',
    year_code: '2026',
    year_status: 'open',
    ledger: '01',
    stages,
    next_stage: next?.stage ?? null,
    is_complete: statuses.every((status) => status === 'completed'),
  };
}

describe('YearEndClosingStore', () => {
  const api = { getClosingWorkflow: vi.fn(), runClosingStage: vi.fn() };
  const glApi = { getFiscalYears: vi.fn() };

  function create() {
    TestBed.configureTestingModule({
      providers: [
        YearEndClosingStore,
        { provide: GeneralLedgerPrimaNotaApiService, useValue: api },
        { provide: GeneralLedgerApiService, useValue: glApi },
      ],
    });
    return TestBed.inject(YearEndClosingStore);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    glApi.getFiscalYears.mockReturnValue(
      of({ success: true, message: '', data: [{ id: 'y1', year_code: '2026' }] }),
    );
    api.getClosingWorkflow.mockReturnValue(
      of({
        success: true,
        message: '',
        data: workflow(['ready', 'blocked', 'blocked', 'blocked']),
      }),
    );
    api.runClosingStage.mockReturnValue(
      of({
        success: true,
        message: '',
        data: { already_completed: false, stage: stage(1, 'completed') },
      }),
    );
  });

  it('loads the fiscal years and the workflow of the selected year and book', async () => {
    const store = create();
    await store.loadYears();
    expect(store.fiscalYears()).toHaveLength(1);

    await store.selectYear('y1');
    expect(api.getClosingWorkflow).toHaveBeenCalledWith('y1', '01');
    expect(store.stages()).toHaveLength(4);
    expect(store.currentIndex()).toBe(0);

    await store.selectLedger('03');
    expect(api.getClosingWorkflow).toHaveBeenLastCalledWith('y1', '03');
  });

  it('only asks to confirm the ready stage', async () => {
    const store = create();
    await store.selectYear('y1');
    store.askConfirmation(2);
    expect(store.pendingStage()).toBeNull();
    store.askConfirmation(1);
    expect(store.pendingStage()).toBe(1);
    store.cancelConfirmation();
    expect(store.pendingStage()).toBeNull();
  });

  it('runs the confirmed stage for the year and book, then reloads the workflow', async () => {
    const store = create();
    await store.selectYear('y1');
    await store.selectLedger('02');
    api.getClosingWorkflow.mockReturnValue(
      of({
        success: true,
        message: '',
        data: workflow(['completed', 'ready', 'blocked', 'blocked']),
      }),
    );

    store.askConfirmation(1);
    const done = await store.confirmStage();

    expect(done).toBe(true);
    expect(api.runClosingStage).toHaveBeenCalledWith('y1', 1, '02');
    expect(store.completedCount()).toBe(1);
    expect(store.currentIndex()).toBe(1);
    expect(store.running()).toBeNull();
  });

  it('does nothing without a confirmation', async () => {
    const store = create();
    await store.selectYear('y1');
    expect(await store.confirmStage()).toBe(false);
    expect(api.runClosingStage).not.toHaveBeenCalled();
  });

  it('keeps the error of a stage that fails and reloads the status', async () => {
    api.runClosingStage.mockReturnValue(throwError(() => new Error('conflict')));
    const store = create();
    await store.selectYear('y1');
    store.askConfirmation(1);
    expect(await store.confirmStage()).toBe(false);
    expect(store.error()).toBeInstanceOf(Error);
    expect(api.getClosingWorkflow).toHaveBeenCalledTimes(2);
  });

  it('reports a complete workflow', async () => {
    api.getClosingWorkflow.mockReturnValue(
      of({
        success: true,
        message: '',
        data: workflow(['completed', 'completed', 'completed', 'completed']),
      }),
    );
    const store = create();
    await store.selectYear('y1');
    expect(store.isComplete()).toBe(true);
    expect(store.currentIndex()).toBe(4);
  });
});
