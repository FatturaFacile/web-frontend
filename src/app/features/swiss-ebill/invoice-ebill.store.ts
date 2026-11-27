import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { EbillInvoiceLifecycle, SwissEbillApiService } from '@core';
import { EBILL_OK, EbillOutcome, failureOf } from './swiss-ebill.util';

export interface InvoiceEbillState {
  invoiceId: string | null;
  lifecycle: EbillInvoiceLifecycle | null;
  loading: boolean;
  working: boolean;
  error: string | null;
  /** Pre-flight violations of the invoice, refreshed with every load and every refused send. */
  violations: { code: string; field: string }[];
}

/** The eBill lifecycle of one invoice: pre-flight, send, revise, retry, cancel and XML download. */
export const InvoiceEbillStore = signalStore(
  withState<InvoiceEbillState>({
    invoiceId: null,
    lifecycle: null,
    loading: false,
    working: false,
    error: null,
    violations: [],
  }),
  withMethods((store, api = inject(SwissEbillApiService)) => {
    const reload = async (): Promise<void> => {
      const id = store.invoiceId();
      if (id === null) {
        return;
      }
      try {
        const lifecycle = (await firstValueFrom(api.getInvoiceLifecycle(id))).data;
        patchState(store, { lifecycle, violations: lifecycle.violations });
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
      }
    };
    const act = async (call: () => Promise<unknown>): Promise<EbillOutcome> => {
      patchState(store, { working: true, error: null });
      try {
        await call();
        await reload();
        patchState(store, { working: false });
        return EBILL_OK;
      } catch (error) {
        const outcome = failureOf(error);
        patchState(store, {
          working: false,
          violations: outcome.violations.length > 0 ? outcome.violations : store.violations(),
        });
        return outcome;
      }
    };
    return {
      load: async (invoiceId: string): Promise<void> => {
        patchState(store, { invoiceId, loading: true, error: null, lifecycle: null });
        await reload();
        patchState(store, { loading: false });
      },
      refresh: reload,
      send: (): Promise<EbillOutcome> =>
        act(() => firstValueFrom(api.sendInvoice(store.invoiceId() ?? ''))),
      revise: (id: string): Promise<EbillOutcome> =>
        act(() => firstValueFrom(api.reviseTransmission(id))),
      retry: (id: string): Promise<EbillOutcome> =>
        act(() => firstValueFrom(api.retryTransmission(id))),
      cancel: (id: string): Promise<EbillOutcome> =>
        act(() => firstValueFrom(api.cancelTransmission(id))),
      download: async (id: string): Promise<Blob | null> => {
        try {
          return await firstValueFrom(api.downloadPayload(id));
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
          return null;
        }
      },
    };
  }),
);
