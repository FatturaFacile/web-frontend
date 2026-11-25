import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  TenderManagementApiService,
  TndBenchmark,
  TndBenchmarkFilters,
  TndBenchmarkPayload,
  TndBenchmarkStatistics,
  TndPageMeta,
} from '@core';
import { failureOf, TND_OK, TndOutcome } from './tender-management.util';

export interface BenchmarksState {
  filters: TndBenchmarkFilters;
  items: TndBenchmark[];
  meta: TndPageMeta | null;
  statistics: TndBenchmarkStatistics | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

const initialState: BenchmarksState = {
  filters: { per_page: PAGE_SIZE, page: 1 },
  items: [],
  meta: null,
  statistics: null,
  loading: false,
  saving: false,
  error: null,
};

/** Competitor award history: the searchable archive and its statistics by contracting authority and CPV. */
export const BenchmarksStore = signalStore(
  withState(initialState),
  withComputed(({ meta, filters }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    hasScope: computed(() => !!(filters().contracting_authority_name || filters().cpv_code)),
  })),
  withMethods((store, api = inject(TenderManagementApiService)) => {
    let sequence = 0;

    const load = async (filters: TndBenchmarkFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const [page, statistics] = await Promise.all([
          firstValueFrom(api.listBenchmarks(filters)),
          firstValueFrom(
            api.getBenchmarkStatistics({
              contracting_authority_name: filters.contracting_authority_name,
              cpv_code: filters.cpv_code,
            }),
          ).catch(() => null),
        ]);
        if (ticket === sequence) {
          patchState(store, {
            items: page.data,
            meta: page.meta,
            statistics: statistics?.data ?? null,
            loading: false,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    const wrap = async (action: () => Promise<void>): Promise<TndOutcome> => {
      patchState(store, { saving: true });
      try {
        await action();
        patchState(store, { saving: false });
        await load(store.filters());
        return TND_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      init: (): Promise<void> => load(store.filters()),
      setFilters: (patch: Partial<TndBenchmarkFilters>): Promise<void> =>
        load({ ...store.filters(), ...patch, page: 1 }),
      setPage: (page: number): Promise<void> => load({ ...store.filters(), page }),
      create: (payload: Partial<TndBenchmarkPayload>): Promise<TndOutcome> =>
        wrap(async () => {
          await firstValueFrom(api.createBenchmark(payload));
        }),
      update: (id: string, payload: Partial<TndBenchmarkPayload>): Promise<TndOutcome> =>
        wrap(async () => {
          await firstValueFrom(api.updateBenchmark(id, payload));
        }),
      remove: (id: string): Promise<TndOutcome> =>
        wrap(async () => {
          await firstValueFrom(api.deleteBenchmark(id));
        }),
    };
  }),
);
