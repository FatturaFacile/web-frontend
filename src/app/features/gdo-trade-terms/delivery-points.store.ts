import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtCustomerRef,
  GdtDeliveryPoint,
  GdtDeliveryPointPayload,
} from '@core';
import { failureOf, GDT_OK, GdtOutcome } from './gdo-trade-terms.util';

export interface DeliveryPointsState {
  points: GdtDeliveryPoint[];
  customers: GdtCustomerRef[];
  contactId: string | null;
  search: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Stores, Ce.Di. and head offices of the retailers. */
export const DeliveryPointsStore = signalStore(
  withState<DeliveryPointsState>({
    points: [],
    customers: [],
    contactId: null,
    search: '',
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ customers }) => ({
    customerName: computed(() => (id: string): string => customers().find((customer) => customer.id === id)?.name ?? ''),
  })),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(
          api.listDeliveryPoints({ contact_id: store.contactId() ?? undefined, q: store.search() || undefined, per_page: 100 }),
        );
        patchState(store, { points: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<GdtOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return GDT_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, { customers: lookups?.data.customers ?? [] });
        await load();
      },
      setFilters(patch: { contactId?: string | null; search?: string }): Promise<void> {
        patchState(store, {
          contactId: patch.contactId === undefined ? store.contactId() : patch.contactId,
          search: patch.search ?? store.search(),
        });
        return load();
      },
      save(id: string | null, payload: GdtDeliveryPointPayload): Promise<GdtOutcome> {
        return write(() =>
          firstValueFrom(id === null ? api.createDeliveryPoint(payload) : api.updateDeliveryPoint(id, payload)),
        );
      },
      remove(id: string): Promise<GdtOutcome> {
        return write(() => firstValueFrom(api.deleteDeliveryPoint(id)));
      },
    };
  }),
);
