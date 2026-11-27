import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import {
  SctDeliveryPayload,
  SctEnvelope,
  SctMovementPayload,
  SctOrder,
  SctProductionPayload,
  SctReceiptPayload,
  SctReceiptPlan,
  SctRegisterLine,
  SubcontractingApiService,
} from '@core';
import { failureOf, SCT_OK, SctOutcome } from './subcontracting.util';

export interface OrderDetailState {
  order: SctOrder | null;
  /** The backflush and the capitalized cost the receipt being filled in would produce. */
  plan: SctReceiptPlan | null;
  /** The lines of the statutory register of this order. */
  ledger: SctRegisterLine[];
  loading: boolean;
  saving: boolean;
  previewing: boolean;
  error: string | null;
}

/** One order with its component lines and the actions of its workflow: every action answers with the order it changed. */
export const OrderDetailStore = signalStore(
  withState<OrderDetailState>({
    order: null,
    plan: null,
    ledger: [],
    loading: false,
    saving: false,
    previewing: false,
    error: null,
  }),
  withMethods((store, api = inject(SubcontractingApiService)) => {
    const load = async (id: string): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        patchState(store, { order: (await firstValueFrom(api.getOrder(id))).data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    /** Runs an action of the workflow and takes the order it returns. */
    const act = async (call: () => Observable<SctEnvelope<SctOrder>>): Promise<SctOutcome> => {
      patchState(store, { saving: true });
      try {
        const response = await firstValueFrom(call());
        patchState(store, { order: response.data, plan: null, saving: false });
        await loadLedger(response.data.id);
        return SCT_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    const loadLedger = async (id: string): Promise<void> => {
      try {
        const response = await firstValueFrom(api.getRegister({ order_id: id, per_page: 200 }));
        patchState(store, { ledger: response.data });
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
      }
    };

    const idOf = (): string => store.order()?.id ?? '';

    return {
      load,
      loadLedger,
      clearPlan: (): void => patchState(store, { plan: null }),
      confirm: (): Promise<SctOutcome> => act(() => api.confirmOrder(idOf())),
      cancel: (): Promise<SctOutcome> => act(() => api.cancelOrder(idOf())),
      dispatch: (payload: SctMovementPayload): Promise<SctOutcome> =>
        act(() => api.dispatchMaterials(idOf(), payload)),
      receive: (payload: SctReceiptPayload): Promise<SctOutcome> =>
        act(() => api.receiveGoods(idOf(), payload)),
      returnUnused: (payload: SctMovementPayload): Promise<SctOutcome> =>
        act(() => api.returnUnused(idOf(), payload)),
      receiveMaterials: (payload: SctMovementPayload): Promise<SctOutcome> =>
        act(() => api.receiveCustomerMaterials(idOf(), payload)),
      produce: (payload: SctProductionPayload): Promise<SctOutcome> =>
        act(() => api.recordProduction(idOf(), payload)),
      deliver: (payload: SctDeliveryPayload): Promise<SctOutcome> =>
        act(() => api.deliverGoods(idOf(), payload)),
      /** The plan of a receipt, for the preview of the backflush and of the capitalized cost. */
      preview: async (payload: SctReceiptPayload): Promise<SctOutcome> => {
        patchState(store, { previewing: true });
        try {
          const response = await firstValueFrom(api.previewReceipt(idOf(), payload));
          patchState(store, { plan: response.data, previewing: false });
          return SCT_OK;
        } catch (error) {
          patchState(store, { plan: null, previewing: false });
          return failureOf(error);
        }
      },
    };
  }),
);
