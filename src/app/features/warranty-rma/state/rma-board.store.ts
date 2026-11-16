import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import {
  RmaBoardColumn,
  RmaBoardFilters,
  WarrantyRmaStatus,
  WarrantyRmaApiService,
  WarrantyStatus,
} from '@core';
import { RMA_BOARD_STATUSES } from '../utils/rma-status';

export interface RmaBoardState {
  columns: RmaBoardColumn[];
  filters: {
    warranty_status: WarrantyStatus | null;
    customer_id: string | null;
    include_closed: boolean;
  };
  isLoading: boolean;
  error: boolean;
  generatedAt: string | null;
}

const initialState: RmaBoardState = {
  columns: [],
  filters: { warranty_status: null, customer_id: null, include_closed: false },
  isLoading: false,
  error: false,
  generatedAt: null,
};

/**
 * Repair bench Kanban. Columns follow the depot workflow; `closed` is only shown with the
 * "include closed" toggle, `cancelled` never. Statuses unknown to the client are appended.
 */
export const RmaBoardStore = signalStore(
  withState(initialState),
  withComputed(({ columns, filters }) => ({
    visibleColumns: computed<RmaBoardColumn[]>(() => {
      const byStatus = new Map(columns().map((c) => [c.status as string, c]));
      const ordered = RMA_BOARD_STATUSES.filter(
        (s) => s !== 'closed' || filters().include_closed,
      ).map((status) => byStatus.get(status) ?? { status, label: status, count: 0, items: [] });
      const known: readonly string[] = [...RMA_BOARD_STATUSES, 'cancelled'];
      const extra = columns().filter((c) => !known.includes(c.status));
      return [...ordered, ...extra];
    }),
  })),
  withMethods((store, api = inject(WarrantyRmaApiService)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: false })),
        switchMap(() => {
          const f = store.filters();
          const params: RmaBoardFilters = {
            warranty_status: f.warranty_status,
            customer_id: f.customer_id,
            include_closed: f.include_closed ? 1 : 0,
          };
          return api.getBoard(params).pipe(
            tap((res) =>
              patchState(store, {
                columns: res.data?.columns ?? [],
                generatedAt: (res.meta?.['generated_at'] as string | undefined) ?? null,
                isLoading: false,
              }),
            ),
            catchError(() => {
              patchState(store, { isLoading: false, error: true });
              return EMPTY;
            }),
          );
        }),
      ),
    ),
  })),
  withMethods((store) => ({
    setFilters(filters: Partial<RmaBoardState['filters']>): void {
      patchState(store, { filters: { ...store.filters(), ...filters } });
      store.load();
    },
    /** Count of a status column (0 when absent). */
    countOf(status: WarrantyRmaStatus): number {
      return store.columns().find((c) => c.status === status)?.count ?? 0;
    },
  })),
);
