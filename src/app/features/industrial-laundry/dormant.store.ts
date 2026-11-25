import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { IlrCustomerRef, IlrDormantGarment, IndustrialLaundryApiService } from '@core';
import { failureOf } from './industrial-laundry.util';

export interface DormantState {
  rows: IlrDormantGarment[];
  customers: IlrCustomerRef[];
  customerId: string | null;
  days: number | null;
  defaultDays: number;
  loading: boolean;
  error: string | null;
}

/** Garments at the customer that were not sent to the wash for more than the threshold (60 days by default). */
export const DormantStore = signalStore(
  withState<DormantState>({
    rows: [],
    customers: [],
    customerId: null,
    days: null,
    defaultDays: 60,
    loading: false,
    error: null,
  }),
  withComputed(({ rows }) => ({
    byCustomer: computed(() => {
      const counts = new Map<string, number>();
      for (const row of rows()) {
        const name = row.customer_name ?? '';
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([customer, count]) => ({ customer, count }))
        .sort((left, right) => right.count - left.count || left.customer.localeCompare(right.customer));
    }),
  })),
  withMethods((store, api = inject(IndustrialLaundryApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(
          api.getDormant({ customer_id: store.customerId() ?? undefined, days: store.days() ?? undefined }),
        );
        patchState(store, { rows: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, {
          customers: lookups?.data.customers ?? [],
          defaultDays: lookups?.data.defaults.dormant_days ?? store.defaultDays(),
        });
        await load();
      },
      setFilters(patch: { customerId?: string | null; days?: number | null }): Promise<void> {
        patchState(store, {
          customerId: patch.customerId === undefined ? store.customerId() : patch.customerId,
          days: patch.days === undefined ? store.days() : patch.days,
        });
        return load();
      },
    };
  }),
);
