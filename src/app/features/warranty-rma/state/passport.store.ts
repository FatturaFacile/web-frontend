import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, forkJoin, pipe, switchMap, tap } from 'rxjs';
import {
  AddExtensionPayload,
  EquipmentPassport,
  Jurisdiction,
  LaravelPaginationMeta,
  PassportGenealogy,
  WarrantyRmaApiService,
} from '@core';
import { ActionResult, RmaNotifier, runRequest } from './action-result';

export interface PassportFilters {
  serial_number: string | null;
  customer_id: string | null;
  jurisdiction: Jurisdiction | null;
  warranty: 'in' | 'out' | null;
}

export interface PassportState {
  items: EquipmentPassport[];
  meta: LaravelPaginationMeta | null;
  filters: PassportFilters;
  page: number;
  isLoading: boolean;
  error: boolean;
  passport: EquipmentPassport | null;
  genealogy: PassportGenealogy | null;
  detailLoading: boolean;
  detailError: boolean;
  saving: boolean;
}

const initialState: PassportState = {
  items: [],
  meta: null,
  filters: { serial_number: null, customer_id: null, jurisdiction: null, warranty: null },
  page: 1,
  isLoading: false,
  error: false,
  passport: null,
  genealogy: null,
  detailLoading: false,
  detailError: false,
  saving: false,
};

export const PassportStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(WarrantyRmaApiService)) => ({
    loadList: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: false })),
        switchMap(() =>
          api.listPassports({ ...store.filters(), page: store.page() }).pipe(
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
          ),
        ),
      ),
    ),
    loadPassport: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { detailLoading: true, detailError: false })),
        switchMap((id) =>
          forkJoin({ passport: api.getPassport(id), genealogy: api.getGenealogy(id) }).pipe(
            tap(({ passport, genealogy }) =>
              patchState(store, {
                passport: passport.data,
                genealogy: genealogy.data,
                detailLoading: false,
              }),
            ),
            catchError(() => {
              patchState(store, { detailLoading: false, detailError: true });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
  })),
  withMethods((store, api = inject(WarrantyRmaApiService), notifier = inject(RmaNotifier)) => ({
    setFilters(filters: Partial<PassportFilters>): void {
      patchState(store, { filters: { ...store.filters(), ...filters }, page: 1 });
      store.loadList();
    },
    setPage(page: number): void {
      patchState(store, { page });
      store.loadList();
    },
    async addExtension(
      id: string,
      payload: AddExtensionPayload,
    ): Promise<ActionResult<EquipmentPassport>> {
      patchState(store, { saving: true });
      const res = await runRequest(api.addExtension(id, payload));
      patchState(store, { saving: false });
      if (!res.ok) {
        return res;
      }
      patchState(store, { passport: res.data.data });
      notifier.success('RMA.MESSAGES.EXTENSION_ADDED');
      return { ok: true, data: res.data.data };
    },
  })),
);
