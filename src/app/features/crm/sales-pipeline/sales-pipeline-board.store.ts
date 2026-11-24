import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  type SalesBoard,
  type SalesBoardFilters,
  type SalesDeal,
  type SalesLossAnswer,
  type SalesLossReason,
  type SalesPipeline,
  SalesPipelineApiService,
} from '@core';
import { applyMove, boardTotals, reconcileTotals } from './sales-pipeline.utils';

export interface SalesBoardState {
  pipelines: SalesPipeline[];
  lossReasons: SalesLossReason[];
  pipelineId: string | null;
  filters: SalesBoardFilters;
  board: SalesBoard | null;
  loading: boolean;
  /** Translation key of the last load error. */
  error: string | null;
  /** Deal id being moved right now (the card shows a spinner). */
  movingDealId: string | null;
}

export type MoveOutcome =
  { ok: true } | { ok: false; reason: 'validation' | 'failed'; errors: Record<string, string[]> };

const initialState: SalesBoardState = {
  pipelines: [],
  lossReasons: [],
  pipelineId: null,
  filters: {},
  board: null,
  loading: false,
  error: null,
  movingDealId: null,
};

function validationErrors(error: unknown): Record<string, string[]> | null {
  if (error instanceof HttpErrorResponse && error.status === 422) {
    const errors = (error.error as { errors?: Record<string, string[]> } | null)?.errors;
    return errors ?? {};
  }
  return null;
}

/**
 * State of the sales Kanban board: pipelines, the board of the selected pipeline with its filters, and the optimistic
 * drag-and-drop move (totals recalculate immediately, and the previous board is restored if the API refuses or fails).
 */
export const SalesPipelineBoardStore = signalStore(
  withState(initialState),
  withComputed(({ board, lossReasons, pipelines, pipelineId }) => ({
    columns: computed(() => board()?.columns ?? []),
    totals: computed(() => board()?.totals ?? null),
    activeLossReasons: computed(() => lossReasons().filter((reason) => reason.is_active)),
    activePipelines: computed(() => pipelines().filter((pipeline) => pipeline.is_active)),
    currentPipeline: computed(
      () =>
        board()?.pipeline ?? pipelines().find((pipeline) => pipeline.id === pipelineId()) ?? null,
    ),
    isEmpty: computed(() => (board()?.columns.length ?? 0) === 0),
  })),
  withMethods((store, api = inject(SalesPipelineApiService)) => {
    let sequence = 0;

    const loadBoard = async (silent = false): Promise<void> => {
      const ticket = ++sequence;
      if (!silent) {
        patchState(store, { loading: true, error: null });
      }
      try {
        const board = await firstValueFrom(api.getBoard(store.pipelineId(), store.filters()));
        if (ticket === sequence) {
          patchState(store, { board, pipelineId: board.pipeline.id, loading: false, error: null });
        }
      } catch {
        if (ticket === sequence && !silent) {
          patchState(store, { loading: false, error: 'SALESPIPE.LOAD_ERROR' });
        }
      }
    };

    const replaceDeal = (deal: SalesDeal): void => {
      const board = store.board();
      if (board === null) {
        return;
      }
      const columns = board.columns.map((column) => ({
        ...column,
        opportunities: column.opportunities.map((candidate) =>
          candidate.id === deal.id ? deal : candidate,
        ),
      }));
      patchState(store, { board: { ...board, columns, totals: boardTotals(columns) } });
    };

    return {
      loadBoard,

      /** Loads the catalog (pipelines, loss reasons) and the board of the default pipeline. */
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [pipelines, lossReasons] = await Promise.all([
            firstValueFrom(api.listPipelines()),
            firstValueFrom(api.listLossReasons()),
          ]);
          patchState(store, { pipelines, lossReasons });
        } catch {
          patchState(store, { loading: false, error: 'SALESPIPE.LOAD_ERROR' });
          return;
        }
        await loadBoard();
      },

      async selectPipeline(pipelineId: string | null): Promise<void> {
        patchState(store, { pipelineId });
        await loadBoard();
      },

      async setFilters(filters: SalesBoardFilters): Promise<void> {
        patchState(store, { filters: { ...store.filters(), ...filters } });
        await loadBoard();
      },

      /** Refresh without the loading state, used for real-time and periodic sync. */
      refreshSilently(): Promise<void> {
        return loadBoard(true);
      },

      /** True when the target stage is a lost stage: the loss questionnaire must be answered first. */
      requiresLossAnswer(stageId: string): boolean {
        return (
          store.columns().find((column) => column.stage.id === stageId)?.stage.is_lost ?? false
        );
      },

      /**
       * Moves a deal. The board changes immediately; if the API fails or refuses (for instance a missing loss
       * answer), the previous board is restored and the failure is reported to the caller.
       */
      async moveDeal(
        dealId: string,
        stageId: string,
        position: number,
        loss?: SalesLossAnswer,
      ): Promise<MoveOutcome> {
        const previous = store.board();
        if (previous === null) {
          return { ok: false, reason: 'failed', errors: {} };
        }

        patchState(store, {
          board: applyMove(previous, dealId, stageId, position),
          movingDealId: dealId,
        });
        try {
          const result = await firstValueFrom(
            api.moveDeal(dealId, { stage_id: stageId, position, ...(loss ?? {}) }),
          );
          const current = store.board();
          if (current !== null) {
            patchState(store, {
              board: reconcileTotals(current, result.stage_totals),
              movingDealId: null,
            });
            replaceDeal(result.opportunity);
          }
          return { ok: true };
        } catch (error) {
          patchState(store, { board: previous, movingDealId: null });
          const errors = validationErrors(error);
          return errors !== null
            ? { ok: false, reason: 'validation', errors }
            : { ok: false, reason: 'failed', errors: {} };
        }
      },

      /** Quick note from the smartphone sheet: replaces the note or appends a timestamped line. */
      async saveNote(dealId: string, notes: string, append: boolean): Promise<boolean> {
        try {
          const deal = await firstValueFrom(api.updateNotes(dealId, notes, append));
          replaceDeal({
            ...(store
              .columns()
              .flatMap((column) => column.opportunities)
              .find((candidate) => candidate.id === dealId) as SalesDeal),
            ...deal,
          });
          return true;
        } catch {
          return false;
        }
      },
    };
  }),
);
