import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  FranchiseNetworkApiService,
  FrnLoyaltyPosition,
  FrnRun,
  FrnSellOut,
  FrnSellOutPayload,
  FrnStore,
} from '@core';
import { defaultPeriod, failureOf, FRN_OK, FrnOutcome } from './franchise-network.util';

export interface BillingState {
  period: string;
  runs: FrnRun[];
  run: FrnRun | null;
  sellOut: FrnSellOut[];
  loyalty: FrnLoyaltyPosition[];
  stores: FrnStore[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/**
 * Monthly billing of the franchisor: the sell-out the stores reported, the royalty and marketing fund run (calculate, review the
 * statement of every store, invoice) and the net loyalty position between the stores.
 */
export const BillingStore = signalStore(
  withState<BillingState>({
    period: defaultPeriod(),
    runs: [],
    run: null,
    sellOut: [],
    loyalty: [],
    stores: [],
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const loadPeriod = async (): Promise<void> => {
      const period = store.period();
      const [sellOut, loyalty] = await Promise.all([
        firstValueFrom(api.listSellOut(period)),
        firstValueFrom(api.getLoyaltySettlement(period)),
      ]);
      patchState(store, { sellOut: sellOut.data, loyalty: loyalty.data });
    };

    const loadRuns = async (): Promise<void> => {
      const runs = await firstValueFrom(api.listRuns());
      patchState(store, { runs: runs.data });
    };

    const guarded = async (work: () => Promise<void>): Promise<FrnOutcome> => {
      patchState(store, { saving: true });
      try {
        await work();
        patchState(store, { saving: false });
        return FRN_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async load(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const lookups = await firstValueFrom(api.getLookups());
          patchState(store, { stores: lookups.data.stores });
          await Promise.all([loadRuns(), loadPeriod()]);
          const existing = store.runs().find((run) => run.period === store.period());
          if (existing) {
            const detail = await firstValueFrom(api.getRun(existing.id));
            patchState(store, { run: detail.data });
          }
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      async setPeriod(period: string): Promise<void> {
        patchState(store, { period, run: null, loading: true, error: null });
        try {
          await loadPeriod();
          const existing = store.runs().find((run) => run.period === period);
          if (existing) {
            const detail = await firstValueFrom(api.getRun(existing.id));
            patchState(store, { run: detail.data });
          }
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      calculate: (): Promise<FrnOutcome> =>
        guarded(async () => {
          const response = await firstValueFrom(api.calculateRun(store.period()));
          patchState(store, { run: response.data });
          await Promise.all([loadRuns(), loadPeriod()]);
        }),
      invoice: (): Promise<FrnOutcome> =>
        guarded(async () => {
          const run = store.run();
          if (run === null) {
            return;
          }
          const response = await firstValueFrom(api.invoiceRun(run.id));
          patchState(store, { run: response.data });
          await loadRuns();
        }),
      saveSellOut: (storeId: string, payload: FrnSellOutPayload): Promise<FrnOutcome> =>
        guarded(async () => {
          await firstValueFrom(api.saveSellOut(storeId, store.period(), payload));
          await loadPeriod();
        }),
    };
  }),
);
