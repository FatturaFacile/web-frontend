import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  SctOrder,
  SctOrderFilters,
  SctOrderPayload,
  SctPageMeta,
  SubcontractingApiService,
} from '@core';
import { failureOf, SCT_OK, SctOutcome } from './subcontracting.util';

export interface OrdersState {
  orders: SctOrder[];
  meta: SctPageMeta | null;
  filters: SctOrderFilters;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export type CreateOutcome = SctOutcome & { order: SctOrder | null };

/** The subcontracting orders: filtered list, creation and the confirmation / cancellation of an order from the list. */
export const OrdersStore = signalStore(
  withState<OrdersState>({
    orders: [],
    meta: null,
    filters: { per_page: 25 },
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(SubcontractingApiService)) => {
    const load = async (filters?: SctOrderFilters): Promise<void> => {
      const active = filters ?? store.filters();
      patchState(store, { filters: active, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listOrders(active));
        patchState(store, { orders: response.data, meta: response.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<SctOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return SCT_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      create: async (payload: SctOrderPayload): Promise<CreateOutcome> => {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.createOrder(payload));
          patchState(store, { saving: false });
          return { ...SCT_OK, order: response.data };
        } catch (error) {
          patchState(store, { saving: false });
          return { ...failureOf(error), order: null };
        }
      },
      confirm: (id: string): Promise<SctOutcome> => write(() => firstValueFrom(api.confirmOrder(id))),
      cancel: (id: string): Promise<SctOutcome> => write(() => firstValueFrom(api.cancelOrder(id))),
    };
  }),
);
