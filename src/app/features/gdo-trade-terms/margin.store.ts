import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { GdoTradeTermsApiService, GdtContract, GdtMargin, GdtMarginFilters } from '@core';
import { currentYear, failureOf } from './gdo-trade-terms.util';

export interface MarginState {
  filters: GdtMarginFilters;
  margin: GdtMargin | null;
  contracts: GdtContract[];
  loading: boolean;
  error: string | null;
}

/** Gross, net and net-net margin of the sales to GDO customers, per product or per contract. */
export const MarginStore = signalStore(
  withState<MarginState>({
    filters: { from: currentYear().start, to: currentYear().end, group_by: 'product' },
    margin: null,
    contracts: [],
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    const load = async (filters: GdtMarginFilters): Promise<void> => {
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getNetNetMargin(filters));
        patchState(store, { margin: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      async init(): Promise<void> {
        const contracts = await firstValueFrom(api.listContracts({ per_page: 100 })).catch(() => null);
        patchState(store, { contracts: contracts?.data ?? [] });
        await load(store.filters());
      },
      setFilters(patch: Partial<GdtMarginFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch });
      },
    };
  }),
);
