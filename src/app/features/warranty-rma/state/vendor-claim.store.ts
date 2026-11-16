import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, Observable, pipe, switchMap, tap } from 'rxjs';
import {
  EsmEnvelope,
  LaravelPaginationMeta,
  PatchVendorClaimPayload,
  VendorClaim,
  VendorClaimStatus,
  VendorClaimTransitionPayload,
  WarrantyRmaApiService,
} from '@core';
import { ActionResult, RmaNotifier, runRequest } from './action-result';

export interface VendorClaimFilters {
  status: VendorClaimStatus | null;
  supplier_id: string | null;
  rma_order_id: string | null;
}

export interface VendorClaimState {
  items: VendorClaim[];
  meta: LaravelPaginationMeta | null;
  filters: VendorClaimFilters;
  page: number;
  isLoading: boolean;
  error: boolean;
  saving: boolean;
}

const initialState: VendorClaimState = {
  items: [],
  meta: null,
  filters: { status: null, supplier_id: null, rma_order_id: null },
  page: 1,
  isLoading: false,
  error: false,
  saving: false,
};

export const VendorClaimStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(WarrantyRmaApiService)) => ({
    loadList: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: false })),
        switchMap(() =>
          api.listVendorClaims({ ...store.filters(), page: store.page() }).pipe(
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
  })),
  withMethods((store, api = inject(WarrantyRmaApiService), notifier = inject(RmaNotifier)) => {
    async function save(
      request: Observable<EsmEnvelope<VendorClaim>>,
      successKey: string,
    ): Promise<ActionResult<VendorClaim>> {
      patchState(store, { saving: true });
      const res = await runRequest(request);
      patchState(store, { saving: false });
      if (res.ok) {
        notifier.success(successKey);
        store.loadList();
        return { ok: true, data: res.data.data };
      }
      if (res.status === 409) {
        notifier.conflict(res.code);
        store.loadList();
      }
      return res;
    }

    return {
      setFilters(filters: Partial<VendorClaimFilters>): void {
        patchState(store, { filters: { ...store.filters(), ...filters }, page: 1 });
        store.loadList();
      },
      setPage(page: number): void {
        patchState(store, { page });
        store.loadList();
      },
      patch(id: string, payload: PatchVendorClaimPayload): Promise<ActionResult<VendorClaim>> {
        return save(api.patchVendorClaim(id, payload), 'RMA.MESSAGES.CLAIM_UPDATED');
      },
      transition(
        id: string,
        payload: VendorClaimTransitionPayload,
      ): Promise<ActionResult<VendorClaim>> {
        return save(api.transitionVendorClaim(id, payload), 'RMA.MESSAGES.CLAIM_TRANSITIONED');
      },
    };
  }),
);
