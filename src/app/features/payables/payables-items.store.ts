import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ApBlockPayload,
  ApItem,
  ApItemFilters,
  ApItemSummary,
  LaravelPaginationMeta,
  PayablesApiService,
} from '@core';
import {
  AP_OK,
  apFailure,
  ApOutcome,
  apiErrorMessage,
  isBlockedItem,
  skontoCapturable,
} from './payables.util';

export interface PayablesItemsState {
  filters: ApItemFilters;
  items: ApItem[];
  meta: LaravelPaginationMeta | null;
  summary: ApItemSummary | null;
  /** The item shown in the detail drawer (with its block history). */
  detail: ApItem | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

const initialState: PayablesItemsState = {
  filters: { open_only: true, per_page: PAGE_SIZE, page: 1 },
  items: [],
  meta: null,
  summary: null,
  detail: null,
  loading: false,
  saving: false,
  error: null,
};

/** Supplier open items and due-date schedule with the Skonto indicators and the dispute / block actions. */
export const PayablesItemsStore = signalStore(
  withState(initialState),
  withComputed(({ items, meta }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    blockedCount: computed(() => items().filter((row) => isBlockedItem(row)).length),
    skontoOpportunities: computed(() => items().filter((row) => skontoCapturable(row)).length),
  })),
  withMethods((store, api = inject(PayablesApiService)) => {
    let sequence = 0;

    const fetch = async (filters: ApItemFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const [list, summary] = await Promise.all([
          firstValueFrom(api.listItems(filters)),
          firstValueFrom(api.getItemSummary(filters.currency)).catch(() => null),
        ]);
        if (ticket === sequence) {
          patchState(store, {
            items: list.data,
            meta: list.meta,
            summary: summary?.data ?? null,
            loading: false,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'AP.LOAD_ERROR' });
        }
      }
    };

    const mergeItem = (updated: ApItem): void => {
      patchState(store, {
        items: store.items().map((row) => (row.id === updated.id ? updated : row)),
        detail: store.detail()?.id === updated.id ? updated : store.detail(),
      });
    };

    return {
      init: (filters: ApItemFilters): Promise<void> =>
        fetch({ open_only: true, per_page: PAGE_SIZE, ...filters, page: 1 }),
      setFilters: (patch: Partial<ApItemFilters>): Promise<void> =>
        fetch({ ...store.filters(), ...patch, page: 1 }),
      resetFilters: (): Promise<void> => fetch({ open_only: true, per_page: PAGE_SIZE, page: 1 }),
      setPage: (page: number): Promise<void> => fetch({ ...store.filters(), page }),
      refresh: (): Promise<void> => fetch(store.filters()),

      /** Loads one item with its dispute / block history. */
      async openDetail(id: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getItem(id));
          patchState(store, { detail: response.data });
        } catch (error) {
          patchState(store, { error: apiErrorMessage(error) ?? 'AP.LOAD_ERROR' });
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null });
      },

      /** Places an item in dispute or under an administrative block. */
      async block(id: string, payload: ApBlockPayload): Promise<ApOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.block(id, payload));
          mergeItem(response.data);
          patchState(store, { saving: false });
          return AP_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return apFailure(error);
        }
      },

      /** Releases a disputed or blocked item; the reason is written to the audit trail by the API. */
      async release(id: string, reason: string): Promise<ApOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.release(id, { reason }));
          mergeItem(response.data);
          patchState(store, { saving: false });
          return AP_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return apFailure(error);
        }
      },
    };
  }),
);
