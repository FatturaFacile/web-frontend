import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtCreditNotePayload,
  GdtDisputeResolution,
  GdtPromoInvoicePayload,
  GdtSettlement,
} from '@core';
import { failureOf, GDT_OK, GdtOutcome } from './gdo-trade-terms.util';

export interface SettlementDetailState {
  settlement: GdtSettlement | null;
  loading: boolean;
  working: boolean;
  error: string | null;
}

/** One settlement run: the credit note of the rebates, the reconciliation of the promotional invoice and the dispute. */
export const SettlementDetailStore = signalStore(
  withState<SettlementDetailState>({ settlement: null, loading: false, working: false, error: null }),
  withComputed(({ settlement }) => ({
    lines: computed(() => settlement()?.lines ?? []),
    creditLines: computed(() => (settlement()?.lines ?? []).filter((line) => line.treatment === 'credit_note')),
    promoLines: computed(() => (settlement()?.lines ?? []).filter((line) => line.treatment === 'promo_invoice')),
    open: computed(() => {
      const status = settlement()?.status;
      return status === 'proposed' || status === 'disputed';
    }),
    hasOpenCreditLines: computed(() => (settlement()?.lines ?? []).some((line) => line.treatment === 'credit_note' && line.status === 'open')),
    hasOpenPromoLines: computed(() => (settlement()?.lines ?? []).some((line) => line.treatment === 'promo_invoice' && (line.status === 'open' || line.status === 'disputed'))),
  })),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    const act = async (call: () => Promise<GdtSettlement>): Promise<GdtOutcome> => {
      patchState(store, { working: true });
      try {
        const settlement = await call();
        const detail = await firstValueFrom(api.getSettlement(settlement.id));
        patchState(store, { settlement: detail.data, working: false });
        return GDT_OK;
      } catch (error) {
        patchState(store, { working: false });
        return failureOf(error);
      }
    };

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null, settlement: null });
        try {
          const response = await firstValueFrom(api.getSettlement(id));
          patchState(store, { settlement: response.data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      creditNote(id: string, payload: GdtCreditNotePayload): Promise<GdtOutcome> {
        return act(async () => (await firstValueFrom(api.settleCreditNote(id, payload))).data);
      },
      promoInvoice(id: string, payload: GdtPromoInvoicePayload): Promise<GdtOutcome> {
        return act(async () => (await firstValueFrom(api.reconcilePromoInvoice(id, payload))).data);
      },
      resolve(id: string, resolution: GdtDisputeResolution, notes: string | null): Promise<GdtOutcome> {
        return act(async () => (await firstValueFrom(api.resolveDispute(id, resolution, notes))).data);
      },
      cancel(id: string): Promise<GdtOutcome> {
        return act(async () => (await firstValueFrom(api.cancelSettlement(id))).data);
      },
    };
  }),
);
