import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtContract,
  GdtPageMeta,
  GdtPromotion,
  GdtPromotionFilters,
} from '@core';
import { failureOf } from './gdo-trade-terms.util';

export interface PromotionsState {
  filters: GdtPromotionFilters;
  promotions: GdtPromotion[];
  meta: GdtPageMeta | null;
  contracts: GdtContract[];
  loading: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

/** The trade promotions of every contract (flyer, sell-out, opening, listing, display, Ce.Di. logistics). */
export const PromotionsStore = signalStore(
  withState<PromotionsState>({
    filters: { per_page: PAGE_SIZE, page: 1 },
    promotions: [],
    meta: null,
    contracts: [],
    loading: false,
    error: null,
  }),
  withComputed(({ meta }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
  })),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    let sequence = 0;

    const load = async (filters: GdtPromotionFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listPromotions(filters));
        if (ticket === sequence) {
          patchState(store, { promotions: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    return {
      async init(): Promise<void> {
        const contracts = await firstValueFrom(api.listContracts({ per_page: 100 })).catch(() => null);
        patchState(store, { contracts: contracts?.data ?? [] });
        await load(store.filters());
      },
      setFilters(patch: Partial<GdtPromotionFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
    };
  }),
);
