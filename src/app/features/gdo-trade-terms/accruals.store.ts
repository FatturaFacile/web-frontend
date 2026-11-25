import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtAccrualLine,
  GdtAccrualResult,
  GdtAccrualRun,
  GdtPageMeta,
} from '@core';
import { currentMonthKey, failureOf, GDT_OK, GdtOutcome } from './gdo-trade-terms.util';

export interface AccrualsState {
  runs: GdtAccrualRun[];
  meta: GdtPageMeta | null;
  period: string;
  preview: GdtAccrualResult | null;
  /** The run whose ledger is open. */
  selected: GdtAccrualRun | null;
  loading: boolean;
  working: boolean;
  error: string | null;
}

const PAGE_SIZE = 24;

/** Monthly accruals (ratei mensili): preview, run, the ledger of a run and the reversal. */
export const AccrualsStore = signalStore(
  withState<AccrualsState>({
    runs: [],
    meta: null,
    period: currentMonthKey(),
    preview: null,
    selected: null,
    loading: false,
    working: false,
    error: null,
  }),
  withComputed(({ preview, runs }) => ({
    previewLines: computed<GdtAccrualLine[]>(() => preview()?.lines ?? []),
    /** Only the latest posted run can be reversed or recalculated. */
    latestPostedId: computed(() => runs().find((run) => run.status === 'posted')?.id ?? null),
  })),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    const load = async (page = 1): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listAccrualRuns({ per_page: PAGE_SIZE, page }));
        patchState(store, { runs: response.data, meta: response.meta, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      load,
      setPeriod(period: string): void {
        patchState(store, { period, preview: null });
      },
      async runPreview(): Promise<GdtOutcome> {
        patchState(store, { working: true });
        try {
          const response = await firstValueFrom(api.previewAccrual(store.period()));
          patchState(store, { preview: response.data, working: false });
          return GDT_OK;
        } catch (error) {
          patchState(store, { working: false, preview: null });
          return failureOf(error);
        }
      },
      async run(recalculate: boolean): Promise<GdtOutcome> {
        patchState(store, { working: true });
        try {
          const response = await firstValueFrom(api.runAccrual({ period: store.period(), recalculate }));
          patchState(store, { working: false, preview: null, selected: response.data.run });
          await load();
          return GDT_OK;
        } catch (error) {
          patchState(store, { working: false });
          return failureOf(error);
        }
      },
      async open(id: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getAccrualRun(id));
          patchState(store, { selected: response.data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      close(): void {
        patchState(store, { selected: null });
      },
      async reverse(id: string, reason: string): Promise<GdtOutcome> {
        patchState(store, { working: true });
        try {
          const response = await firstValueFrom(api.reverseAccrualRun(id, reason));
          patchState(store, { working: false, selected: response.data });
          await load();
          return GDT_OK;
        } catch (error) {
          patchState(store, { working: false });
          return failureOf(error);
        }
      },
    };
  }),
);
