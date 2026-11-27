import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { DistributionApiService, DstInTransitFilters, DstInTransitLine, DstLookups } from '@core';
import { failureOf, toNumber } from './distribution.util';

export interface InTransitState {
  lines: DstInTransitLine[];
  filters: DstInTransitFilters;
  totalUnits: number;
  totalValue: number;
  lookups: DstLookups | null;
  loading: boolean;
  error: string | null;
}

/** Goods in transit: every line on its way, by SKU, route, lot and expected arrival. */
export const InTransitStore = signalStore(
  withState<InTransitState>({
    lines: [],
    filters: {},
    totalUnits: 0,
    totalValue: 0,
    lookups: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listInTransit(store.filters()));
        patchState(store, {
          lines: response.data,
          totalUnits: toNumber(response.meta['total_units'] as number | string | undefined),
          totalValue: toNumber(response.meta['total_value'] as number | string | undefined),
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      load,
      async init(): Promise<void> {
        try {
          patchState(store, { lookups: (await firstValueFrom(api.getLookups())).data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
        await load();
      },
      setFilters(filters: DstInTransitFilters): Promise<void> {
        patchState(store, { filters });
        return load();
      },
    };
  }),
);
