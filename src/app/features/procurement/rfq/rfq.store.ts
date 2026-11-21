import { computed, inject } from '@angular/core';
import { RfqApiService, RfqListFilters } from '@data-access/procurement/rfq-api.service';
import {
  BidComparisonMatrix,
  RfqStatus,
  RfqSummary,
} from '@domain/procurement/rfq.models';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';

export interface RfqState {
  rfqs: RfqSummary[];
  total: number;
  page: number;
  perPage: number;
  statusFilter: RfqStatus | null;
  searchFilter: string;
  selectedRfq: RfqSummary | null;
  matrix: BidComparisonMatrix | null;
  loadingList: boolean;
  loadingDetail: boolean;
  loadingMatrix: boolean;
  busy: boolean;
  error: string | null;
}

const initialState: RfqState = {
  rfqs: [],
  total: 0,
  page: 1,
  perPage: 25,
  statusFilter: null,
  searchFilter: '',
  selectedRfq: null,
  matrix: null,
  loadingList: false,
  loadingDetail: false,
  loadingMatrix: false,
  busy: false,
  error: null,
};

export const RfqStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ rfqs, matrix }) => ({
    openCount: computed(
      () =>
        rfqs().filter((r) =>
          ['published', 'bidding_open', 'issued', 'under_evaluation'].includes(r.status),
        ).length,
    ),
    awardedCount: computed(() => rfqs().filter((r) => r.status === 'awarded').length),
    hasMatrixBids: computed(() => (matrix()?.columns.length ?? 0) > 0),
  })),
  withMethods((store, api = inject(RfqApiService)) => ({
    setFilters(statusFilter: RfqStatus | null, searchFilter: string): void {
      patchState(store, { statusFilter, searchFilter, page: 1 });
    },

    loadList(overrides?: Partial<RfqListFilters>): Observable<RfqSummary[]> {
      patchState(store, { loadingList: true, error: null });
      const filters: RfqListFilters = {
        status: overrides?.status !== undefined ? overrides.status : store.statusFilter(),
        search: overrides?.search !== undefined ? overrides.search : store.searchFilter(),
        page: overrides?.page ?? store.page(),
        per_page: overrides?.per_page ?? store.perPage(),
      };

      return api.listRfqs(filters).pipe(
        tap((res) => {
          patchState(store, {
            rfqs: res.data ?? [],
            total: res.meta?.total ?? (res.data ?? []).length,
            page: res.meta?.current_page ?? filters.page ?? 1,
          });
        }),
        map((res) => res.data ?? []),
        catchError((err: unknown) => {
          patchState(store, { error: String(err) });
          return of([]);
        }),
        finalize(() => patchState(store, { loadingList: false })),
      );
    },

    loadDetail(rfqId: string): Observable<RfqSummary | null> {
      patchState(store, { loadingDetail: true, error: null });

      return api.getRfq(rfqId).pipe(
        map((res) => res.data),
        tap((rfq) => patchState(store, { selectedRfq: rfq })),
        catchError((err: unknown) => {
          patchState(store, { selectedRfq: null, error: String(err) });
          return of(null);
        }),
        finalize(() => patchState(store, { loadingDetail: false })),
      );
    },

    loadMatrix(rfqId: string): Observable<BidComparisonMatrix | null> {
      patchState(store, { loadingMatrix: true, error: null });

      return api.getComparisonMatrix(rfqId).pipe(
        map((res) => res.data),
        tap((matrix) => patchState(store, { matrix })),
        catchError((err: unknown) => {
          patchState(store, { matrix: null, error: String(err) });
          return of(null);
        }),
        finalize(() => patchState(store, { loadingMatrix: false })),
      );
    },

    setBusy(busy: boolean): void {
      patchState(store, { busy });
    },
  })),
);
