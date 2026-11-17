import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import {
  LaravelPaginationMeta,
  Loaner,
  LoanerRegisterType,
  LoanerStatus,
  ReturnLoanerPayload,
  WarrantyRmaApiService,
} from '@core';
import { ActionResult, RmaNotifier, runRequest } from './action-result';

export interface LoanerFilters {
  status: LoanerStatus | null;
  register_type: LoanerRegisterType | null;
  overdue: boolean;
}

export interface LoanerState {
  items: Loaner[];
  meta: LaravelPaginationMeta | null;
  filters: LoanerFilters;
  page: number;
  isLoading: boolean;
  error: boolean;
  busyId: string | null;
}

const initialState: LoanerState = {
  items: [],
  meta: null,
  filters: { status: null, register_type: null, overdue: false },
  page: 1,
  isLoading: false,
  error: false,
  busyId: null,
};

export const LoanerStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(WarrantyRmaApiService)) => ({
    loadList: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: false })),
        switchMap(() => {
          const f = store.filters();
          return api
            .listLoaners({
              status: f.status,
              register_type: f.register_type,
              overdue: f.overdue ? 1 : null,
              page: store.page(),
            })
            .pipe(
              tap((res) =>
                patchState(store, {
                  items: res.data ?? [],
                  meta: res.meta ?? null,
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
  withMethods((store, api = inject(WarrantyRmaApiService), notifier = inject(RmaNotifier)) => {
    async function act(
      id: string,
      request: ReturnType<typeof api.returnLoaner>,
      successKey: string,
    ) {
      patchState(store, { busyId: id });
      const res = await runRequest(request);
      patchState(store, { busyId: null });
      if (res.ok) {
        notifier.success(successKey);
        store.loadList();
        return { ok: true as const, data: res.data.data };
      }
      if (res.status === 409) {
        notifier.conflict(res.code);
        store.loadList();
      }
      return res;
    }

    return {
      setFilters(filters: Partial<LoanerFilters>): void {
        patchState(store, { filters: { ...store.filters(), ...filters }, page: 1 });
        store.loadList();
      },
      setPage(page: number): void {
        patchState(store, { page });
        store.loadList();
      },
      returnLoaner(id: string, payload: ReturnLoanerPayload = {}): Promise<ActionResult<Loaner>> {
        return act(id, api.returnLoaner(id, payload), 'RMA.MESSAGES.LOANER_RETURNED');
      },
      markLost(id: string): Promise<ActionResult<Loaner>> {
        return act(id, api.markLoanerLost(id), 'RMA.MESSAGES.LOANER_LOST');
      },
    };
  }),
);
