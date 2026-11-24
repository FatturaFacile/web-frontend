import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesPipelineApiService, type MoveSalesDealResult } from '@core';
import { SalesPipelineBoardStore } from './sales-pipeline-board.store';
import { boardFixture, deal, LOSS_REASONS, PIPELINE } from './sales-pipeline.fixtures';

describe('SalesPipelineBoardStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof SalesPipelineBoardStore>;

  const moved = (): MoveSalesDealResult => ({
    opportunity: deal('d1', 's2', 10000, 75, {
      weighted_amount: 7500,
      forecast_category: 'commit',
    }),
    stage_totals: {
      s1: { count: 1, amount: '5000.00', weighted_amount: '1250.00' },
      s2: { count: 2, amount: '12000.00', weighted_amount: '9000.00' },
    },
  });

  beforeEach(() => {
    api = {
      listPipelines: vi.fn(() => of([PIPELINE])),
      listLossReasons: vi.fn(() => of(LOSS_REASONS)),
      getBoard: vi.fn(() => of(boardFixture())),
      moveDeal: vi.fn(() => of(moved())),
      updateNotes: vi.fn((id: string, notes: string) => of(deal(id, 's1', 10000, 25, { notes }))),
    };
    TestBed.configureTestingModule({
      providers: [SalesPipelineBoardStore, { provide: SalesPipelineApiService, useValue: api }],
    });
    store = TestBed.inject(SalesPipelineBoardStore);
  });

  it('loads the catalog and the board of the default pipeline', async () => {
    await store.init();

    expect(api['getBoard']).toHaveBeenCalledWith(null, {});
    expect(store.pipelineId()).toBe('p1');
    expect(store.columns()).toHaveLength(4);
    expect(store.totals()?.weighted_amount).toBe('5250.00');
    expect(store.activeLossReasons().map((reason) => reason.code)).toEqual([
      'price',
      'specific_competitor',
    ]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('reports a load error with a translation key and keeps the page retryable', async () => {
    api['getBoard'] = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    await store.init();

    expect(store.error()).toBe('SALESPIPE.LOAD_ERROR');
    expect(store.loading()).toBe(false);

    api['getBoard'] = vi.fn(() => of(boardFixture()));
    await store.loadBoard();
    expect(store.error()).toBeNull();
    expect(store.columns()).toHaveLength(4);
  });

  it('reloads the board with the new pipeline or filters', async () => {
    api['getBoard'] = vi.fn((id: string | null) =>
      of({ ...boardFixture(), pipeline: { ...PIPELINE, id: id ?? 'p1' } }),
    );
    await store.init();
    await store.selectPipeline('p2');
    await store.setFilters({ owner_user_id: 'u9', search: 'acme' });

    expect(api['getBoard']).toHaveBeenLastCalledWith('p2', { owner_user_id: 'u9', search: 'acme' });
  });

  it('moves a deal optimistically and reconciles the totals with the API answer', async () => {
    await store.init();
    const pending = new Subject<MoveSalesDealResult>();
    api['moveDeal'] = vi.fn(() => pending.asObservable());

    const outcome = store.moveDeal('d1', 's2', 0);

    // Before the API answers the totals already follow the drag.
    expect(store.columns()[0].totals).toEqual({
      count: 1,
      amount: '5000.00',
      weighted_amount: '1250.00',
    });
    expect(store.columns()[1].totals.weighted_amount).toBe('9000.00');
    expect(store.movingDealId()).toBe('d1');

    pending.next(moved());
    pending.complete();

    expect(await outcome).toEqual({ ok: true });
    expect(api['moveDeal']).toHaveBeenCalledWith('d1', { stage_id: 's2', position: 0 });
    expect(store.movingDealId()).toBeNull();
    expect(store.columns()[1].opportunities[0]).toMatchObject({ id: 'd1', weighted_amount: 7500 });
  });

  it('rolls the board back when the move fails', async () => {
    await store.init();
    const before = store.board();
    api['moveDeal'] = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));

    const outcome = await store.moveDeal('d1', 's2', 0);

    expect(outcome).toEqual({ ok: false, reason: 'failed', errors: {} });
    expect(store.board()).toBe(before);
    expect(store.movingDealId()).toBeNull();
  });

  it('refuses a lost move without the questionnaire and restores the board', async () => {
    await store.init();
    const before = store.board();
    api['moveDeal'] = vi.fn(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { errors: { loss_reason_code: ['required'], competitor: ['required'] } },
          }),
      ),
    );

    expect(store.requiresLossAnswer('s4')).toBe(true);
    expect(store.requiresLossAnswer('s2')).toBe(false);

    const outcome = await store.moveDeal('d1', 's4', 0);

    expect(outcome).toEqual({
      ok: false,
      reason: 'validation',
      errors: { loss_reason_code: ['required'], competitor: ['required'] },
    });
    expect(store.board()).toBe(before);
  });

  it('sends the loss reason, the winning competitor and the notes with a lost move', async () => {
    await store.init();
    api['moveDeal'] = vi.fn(() =>
      of({ opportunity: deal('d1', 's4', 10000, 0, { status: 'lost' }), stage_totals: {} }),
    );

    const outcome = await store.moveDeal('d1', 's4', 0, {
      loss_reason_code: 'price',
      competitor: 'Rival SA',
      loss_notes: '20% cheaper',
    });

    expect(outcome).toEqual({ ok: true });
    expect(api['moveDeal']).toHaveBeenCalledWith('d1', {
      stage_id: 's4',
      position: 0,
      loss_reason_code: 'price',
      competitor: 'Rival SA',
      loss_notes: '20% cheaper',
    });
    expect(store.columns()[3].opportunities[0].status).toBe('lost');
  });

  it('stores a quick note on the deal card', async () => {
    await store.init();

    expect(await store.saveNote('d1', 'Called the buyer', true)).toBe(true);
    expect(api['updateNotes']).toHaveBeenCalledWith('d1', 'Called the buyer', true);
    expect(store.columns()[0].opportunities.find((candidate) => candidate.id === 'd1')?.notes).toBe(
      'Called the buyer',
    );

    api['updateNotes'] = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(await store.saveNote('d1', 'x', false)).toBe(false);
  });

  it('refreshes silently without flashing the loading state', async () => {
    await store.init();
    const states: boolean[] = [];
    api['getBoard'] = vi.fn(() => {
      states.push(store.loading());
      return of(boardFixture());
    });

    await store.refreshSilently();

    expect(states).toEqual([false]);
  });
});
