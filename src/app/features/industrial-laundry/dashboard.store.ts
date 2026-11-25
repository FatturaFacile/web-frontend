import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IlrCustomerRef,
  IlrParStockRow,
  IlrSegment,
  IndustrialLaundryApiService,
} from '@core';
import { failureOf } from './industrial-laundry.util';

export interface DashboardState {
  rows: IlrParStockRow[];
  customers: IlrCustomerRef[];
  segment: IlrSegment | null;
  customerId: string | null;
  loading: boolean;
  error: string | null;
}

/** Par level against circulating stock per customer (hotel, restaurant, clinic, nursing home) with the billing preview of the month. */
export const DashboardStore = signalStore(
  withState<DashboardState>({
    rows: [],
    customers: [],
    segment: null,
    customerId: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(IndustrialLaundryApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(
          api.getParStock({
            segment: store.segment() ?? undefined,
            customer_id: store.customerId() ?? undefined,
          }),
        );
        patchState(store, { rows: response.data, loading: false });
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
      setFilters(patch: { segment?: IlrSegment | null; customerId?: string | null }): Promise<void> {
        patchState(store, {
          segment: patch.segment === undefined ? store.segment() : patch.segment,
          customerId: patch.customerId === undefined ? store.customerId() : patch.customerId,
        });
        return load();
      },
      load,
    };
  }),
);
