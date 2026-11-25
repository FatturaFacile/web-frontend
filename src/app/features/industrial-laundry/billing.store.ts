import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IlrBillingPayload,
  IlrBillingPreview,
  IlrBillingRun,
  IlrParContractRef,
  IndustrialLaundryApiService,
} from '@core';
import { failureOf, ILR_OK, IlrOutcome } from './industrial-laundry.util';

export interface BillingState {
  contracts: IlrParContractRef[];
  runs: IlrBillingRun[];
  preview: IlrBillingPreview | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The monthly wash and rental billing: preview, consolidation with its draft invoice, history of the runs. */
export const BillingStore = signalStore(
  withState<BillingState>({
    contracts: [],
    runs: [],
    preview: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(IndustrialLaundryApiService)) => {
    const loadRuns = async (): Promise<void> => {
      const response = await firstValueFrom(api.listBillingRuns());
      patchState(store, { runs: response.data });
    };

    const write = async (call: () => Promise<unknown>): Promise<IlrOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await loadRuns();
        return ILR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [contracts] = await Promise.all([firstValueFrom(api.listParContracts()), loadRuns()]);
          patchState(store, { contracts: contracts.data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      async previewFor(payload: IlrBillingPayload): Promise<IlrOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.previewBilling(payload));
          patchState(store, { saving: false, preview: response.data });
          return ILR_OK;
        } catch (error) {
          patchState(store, { saving: false, preview: null });
          return failureOf(error);
        }
      },
      async calculate(payload: IlrBillingPayload): Promise<IlrOutcome> {
        const outcome = await write(() => firstValueFrom(api.calculateBilling(payload)));
        if (outcome.ok) {
          patchState(store, { preview: null });
        }
        return outcome;
      },
      invoice(runId: string): Promise<IlrOutcome> {
        return write(() => firstValueFrom(api.invoiceBillingRun(runId)));
      },
      clearPreview(): void {
        patchState(store, { preview: null });
      },
    };
  }),
);
