import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IlrCustomerRef,
  IlrPpeAlert,
  IlrPpeDecisionPayload,
  IndustrialLaundryApiService,
} from '@core';
import { failureOf, ILR_OK, IlrOutcome } from './industrial-laundry.util';

export interface PpeMonitorState {
  alerts: IlrPpeAlert[];
  customers: IlrCustomerRef[];
  customerId: string | null;
  limitReachedOnly: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** PPE garments near or at their certified wash limit, with the decision on each: replace, mend or condemn. */
export const PpeMonitorStore = signalStore(
  withState<PpeMonitorState>({
    alerts: [],
    customers: [],
    customerId: null,
    limitReachedOnly: false,
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ alerts, customers }) => ({
    reachedCount: computed(() => alerts().filter((alert) => alert.status === 'limit_reached').length),
    nearCount: computed(() => alerts().filter((alert) => alert.status === 'near_limit').length),
    customerName: computed(
      () =>
        (id: string | null): string =>
          customers().find((customer) => customer.id === id)?.name ?? '',
    ),
  })),
  withMethods((store, api = inject(IndustrialLaundryApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(
          api.getPpeAlerts(store.customerId() ?? undefined, store.limitReachedOnly()),
        );
        patchState(store, { alerts: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, { customers: lookups?.data.customers ?? [] });
        await load();
      },
      setFilters(patch: { customerId?: string | null; limitReachedOnly?: boolean }): Promise<void> {
        patchState(store, {
          customerId: patch.customerId === undefined ? store.customerId() : patch.customerId,
          limitReachedOnly: patch.limitReachedOnly ?? store.limitReachedOnly(),
        });
        return load();
      },
      async decide(garmentId: string, payload: IlrPpeDecisionPayload): Promise<IlrOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.decidePpe(garmentId, payload));
          patchState(store, { saving: false });
          await load();
          return ILR_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
    };
  }),
);
