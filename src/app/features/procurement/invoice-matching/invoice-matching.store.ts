import { computed, inject } from '@angular/core';
import { LaravelPaginationMeta } from '@core/models';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import {
  BatchRunPayload,
  InvoiceMatchBatchResult,
  InvoiceMatchFilters,
  InvoiceMatchGrIr,
  InvoiceMatchRun,
  InvoiceMatchSummary,
  OverridePayload,
  PartialResolutionPayload,
  RematchPayload,
  RequestCreditNotePayload,
  RunMatchingPayload,
} from '@domain/procurement/invoice-matching.models';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import { extractApiErrorMessage } from '../requisitions/pr-status.helpers';
import { blockingLines, canResolve, isForbidden } from './invoice-matching.helpers';

export interface InvoiceMatchingState {
  summary: InvoiceMatchSummary | null;
  filters: InvoiceMatchFilters;
  runs: InvoiceMatchRun[];
  meta: LaravelPaginationMeta | null;
  detail: InvoiceMatchRun | null;
  grIr: InvoiceMatchGrIr | null;
  history: InvoiceMatchRun[];
  loading: boolean;
  busy: boolean;
  /** `true` when the last read failed; `error` then holds the API message when there was one. */
  failed: boolean;
  error: string | null;
}

/** Result of a mutation: the view shows a translated message, so the API text is only a detail. */
export interface MatchingOutcome<T = InvoiceMatchRun> {
  ok: boolean;
  forbidden: boolean;
  message: string | null;
  result: T | null;
}

const PAGE_SIZE = 20;

const initialState: InvoiceMatchingState = {
  summary: null,
  filters: { page: 1, per_page: PAGE_SIZE },
  runs: [],
  meta: null,
  detail: null,
  grIr: null,
  history: [],
  loading: false,
  busy: false,
  failed: false,
  error: null,
};

/** Signal store of the matching workbench, the blocked queue and the detail page of Mod 048. */
export const InvoiceMatchingStore = signalStore(
  withState(initialState),
  withComputed(({ meta, detail, summary }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    /** The resolution controls are shown only while the displayed run blocks the payment. */
    canResolve: computed(() => canResolve(detail())),
    blockingLines: computed(() => blockingLines(detail())),
    blockedCount: computed(() => summary()?.blocked_count ?? 0),
  })),
  withMethods((store, api = inject(InvoiceMatchingApiService)) => {
    let runsTicket = 0;

    const fail = (error: unknown): void =>
      patchState(store, {
        loading: false,
        failed: true,
        error: extractApiErrorMessage(error) || null,
      });

    const mutate = async <T = InvoiceMatchRun>(
      call: Observable<T>,
      onSuccess?: (result: T) => void,
    ): Promise<MatchingOutcome<T>> => {
      patchState(store, { busy: true });
      try {
        const result = await firstValueFrom(call);
        onSuccess?.(result);
        patchState(store, { busy: false });
        return { ok: true, forbidden: false, message: null, result };
      } catch (error) {
        patchState(store, { busy: false });
        return {
          ok: false,
          forbidden: isForbidden(error),
          message: extractApiErrorMessage(error) || null,
          result: null,
        };
      }
    };

    const applyRun = (run: InvoiceMatchRun): void =>
      patchState(store, {
        detail: run,
        runs: store
          .runs()
          .map((row) => (row.passive_invoice_id === run.passive_invoice_id ? run : row)),
      });

    const loadRuns = async (filters: InvoiceMatchFilters): Promise<void> => {
      const ticket = ++runsTicket;
      patchState(store, { filters, loading: true, failed: false, error: null });
      try {
        const response = await firstValueFrom(api.listRuns(filters));
        if (ticket === runsTicket) {
          patchState(store, {
            runs: response.data ?? [],
            meta: response.meta ?? null,
            loading: false,
          });
        }
      } catch (error) {
        if (ticket === runsTicket) {
          fail(error);
        }
      }
    };

    return {
      async loadSummary(): Promise<void> {
        try {
          patchState(store, { summary: await firstValueFrom(api.summary()) });
        } catch (error) {
          fail(error);
        }
      },

      loadRuns: (filters: InvoiceMatchFilters = store.filters()): Promise<void> =>
        loadRuns(filters),

      /** Applies a filter change and goes back to the first page. */
      applyFilters(change: Partial<InvoiceMatchFilters>): Promise<void> {
        return loadRuns({ ...store.filters(), ...change, page: 1 });
      },

      setPage(page: number): Promise<void> {
        return loadRuns({ ...store.filters(), page });
      },

      // --- Detail ---

      async loadDetail(id: string): Promise<void> {
        patchState(store, {
          loading: true,
          failed: false,
          error: null,
          detail: null,
          grIr: null,
          history: [],
        });
        try {
          patchState(store, { detail: await firstValueFrom(api.getRun(id)), loading: false });
        } catch (error) {
          fail(error);
        }
      },

      async loadGrIr(id: string): Promise<void> {
        try {
          patchState(store, { grIr: await firstValueFrom(api.getGrIr(id)) });
        } catch (error) {
          fail(error);
        }
      },

      async loadHistory(passiveInvoiceId: string): Promise<void> {
        try {
          patchState(store, {
            history: await firstValueFrom(api.invoiceHistory(passiveInvoiceId)),
          });
        } catch (error) {
          fail(error);
        }
      },

      // --- Runs ---

      run(payload: RunMatchingPayload): Promise<MatchingOutcome> {
        return mutate(api.run(payload));
      },

      batchRun(payload: BatchRunPayload): Promise<MatchingOutcome<InvoiceMatchBatchResult>> {
        return mutate(api.batchRun(payload));
      },

      // --- Resolution of a blocked run ---

      requestCreditNote(id: string, payload: RequestCreditNotePayload): Promise<MatchingOutcome> {
        return mutate(api.requestCreditNote(id, payload), applyRun);
      },

      rematch(id: string, payload: RematchPayload): Promise<MatchingOutcome> {
        return mutate(api.rematch(id, payload), applyRun);
      },

      partialResolution(id: string, payload: PartialResolutionPayload): Promise<MatchingOutcome> {
        return mutate(api.partialResolution(id, payload), applyRun);
      },

      override(id: string, payload: OverridePayload): Promise<MatchingOutcome> {
        return mutate(api.override(id, payload), applyRun);
      },
    };
  }),
);
