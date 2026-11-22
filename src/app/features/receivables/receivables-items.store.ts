import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ArDisputePayload,
  ArItem,
  ArItemFilters,
  LaravelPaginationMeta,
  ReceivablesApiService,
} from '@core';
import { AR_OK, arFailure, ArOutcome, apiErrorMessage, isOpenItem, sumAmounts } from './receivables.util';

export interface ItemsState {
  filters: ArItemFilters;
  items: ArItem[];
  meta: LaravelPaginationMeta | null;
  /** Ids of the rows ticked for a reconciliation. */
  selectedIds: string[];
  /** The item whose allocations are shown (with the allocations of the API). */
  detail: ArItem | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

const initialState: ItemsState = {
  filters: { open_only: true, per_page: PAGE_SIZE, page: 1 },
  items: [],
  meta: null,
  selectedIds: [],
  detail: null,
  loading: false,
  saving: false,
  error: null,
};

/** Open items list with drill-down filters, row selection for the reconciliation and the dispute actions. */
export const ReceivablesItemsStore = signalStore(
  withState(initialState),
  withComputed(({ items, selectedIds, meta }) => {
    const selectedItems = computed(() => items().filter((row) => selectedIds().includes(row.id)));
    return {
      selectedItems,
      selectionCount: computed(() => selectedIds().length),
      /** A reconciliation is made for the items of one customer in one currency. */
      selectionIsCoherent: computed(() => {
        const rows = selectedItems();
        return (
          rows.length > 0 &&
          rows.every(
            (row) => row.customer_id === rows[0].customer_id && row.currency === rows[0].currency,
          )
        );
      }),
      selectionOpenAmount: computed(() =>
        sumAmounts(selectedItems().map((row) => row.open_amount)),
      ),
      selectableIds: computed(() => items().filter((row) => isOpenItem(row)).map((row) => row.id)),
      total: computed(() => meta()?.total ?? 0),
      page: computed(() => meta()?.current_page ?? 1),
      pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    };
  }),
  withMethods((store, api = inject(ReceivablesApiService)) => {
    let sequence = 0;

    const fetch = async (filters: ArItemFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listItems(filters));
        if (ticket === sequence) {
          patchState(store, {
            items: response.data,
            meta: response.meta,
            selectedIds: store.selectedIds().filter((id) => response.data.some((row) => row.id === id)),
            loading: false,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, {
            loading: false,
            error: apiErrorMessage(error) ?? 'AR.LOAD_ERROR',
          });
        }
      }
    };

    /** Replaces rows with their fresh copies (answer of an allocation or a dispute call). */
    const mergeItems = (updated: readonly ArItem[]): void => {
      const byId = new Map(updated.map((row) => [row.id, row]));
      patchState(store, {
        items: store.items().map((row) => byId.get(row.id) ?? row),
        detail: store.detail() ? (byId.get(store.detail()?.id ?? '') ?? store.detail()) : null,
      });
    };

    return {
      /** Opens the list on a set of filters (the drill-down of the dashboard) on the first page. */
      init: (filters: ArItemFilters): Promise<void> =>
        fetch({ open_only: true, per_page: PAGE_SIZE, ...filters, page: 1 }),
      /** Changes some filters and goes back to the first page. */
      setFilters: (patch: Partial<ArItemFilters>): Promise<void> =>
        fetch({ ...store.filters(), ...patch, page: 1 }),
      resetFilters: (): Promise<void> => fetch({ open_only: true, per_page: PAGE_SIZE, page: 1 }),
      setPage: (page: number): Promise<void> => fetch({ ...store.filters(), page }),
      refresh: (): Promise<void> => fetch(store.filters()),

      toggle(id: string, selected: boolean): void {
        const current = store.selectedIds().filter((value) => value !== id);
        patchState(store, { selectedIds: selected ? [...current, id] : current });
      },
      toggleAll(selected: boolean): void {
        patchState(store, { selectedIds: selected ? store.selectableIds() : [] });
      },
      clearSelection(): void {
        patchState(store, { selectedIds: [] });
      },

      /** Loads one item with its allocations (the reversal works on those). */
      async openDetail(id: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getItem(id));
          patchState(store, { detail: response.data });
        } catch (error) {
          patchState(store, { error: apiErrorMessage(error) ?? 'AR.LOAD_ERROR' });
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null });
      },

      /** Marks (with a reason) or clears the dispute of an item. */
      async setDispute(id: string, payload: ArDisputePayload): Promise<ArOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.setDispute(id, payload));
          mergeItems([response.data]);
          patchState(store, { saving: false });
          return AR_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return arFailure(error);
        }
      },

      /** Reverses an allocation of the open detail and reloads the page: the status of the rows changed. */
      async reverseAllocation(allocationId: string): Promise<ArOutcome> {
        patchState(store, { saving: true });
        const detailId = store.detail()?.id ?? null;
        try {
          await firstValueFrom(api.reverseAllocation(allocationId));
          patchState(store, { saving: false });
          await fetch(store.filters());
          if (detailId) {
            const response = await firstValueFrom(api.getItem(detailId));
            patchState(store, { detail: response.data });
          }
          return AR_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return arFailure(error);
        }
      },

      /** After a reconciliation: the fresh rows replace the old ones and the selection is cleared. */
      applyAllocation(updated: readonly ArItem[]): void {
        mergeItems(updated);
        patchState(store, { selectedIds: [] });
      },
    };
  }),
);
