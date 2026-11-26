import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  PcLookups,
  PcPageMeta,
  PcProduct,
  PcProductFilters,
  ProductCatalogApiService,
} from '@core';
import { failureOf, PC_OK, PcOutcome } from './product-catalog.util';

export interface CatalogProductsState {
  filters: PcProductFilters;
  products: PcProduct[];
  meta: PcPageMeta | null;
  lookups: PcLookups | null;
  loading: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

/** The catalog list: filters, paging, the lookups of the filters and the deletion of a product. */
export const CatalogProductsStore = signalStore(
  withState<CatalogProductsState>({
    filters: { kind: 'catalog', per_page: PAGE_SIZE, page: 1 },
    products: [],
    meta: null,
    lookups: null,
    loading: false,
    error: null,
  }),
  withComputed(({ meta, lookups }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    productTypes: computed(() => lookups()?.product_types ?? []),
    kitTypes: computed(() => lookups()?.kit_types ?? []),
  })),
  withMethods((store, api = inject(ProductCatalogApiService)) => {
    let sequence = 0;

    const load = async (filters: PcProductFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listProducts(filters));
        if (ticket === sequence) {
          patchState(store, { products: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    return {
      async init(): Promise<void> {
        try {
          const lookups = await firstValueFrom(api.getLookups());
          patchState(store, { lookups: lookups.data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
        await load(store.filters());
      },

      async setFilters(change: Partial<PcProductFilters>): Promise<void> {
        await load({ ...store.filters(), ...change, page: 1 });
      },

      async setPage(page: number): Promise<void> {
        await load({ ...store.filters(), page });
      },

      async reload(): Promise<void> {
        await load(store.filters());
      },

      async remove(id: string): Promise<PcOutcome> {
        try {
          await firstValueFrom(api.deleteProduct(id));
          await load(store.filters());
          return PC_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
    };
  }),
);
