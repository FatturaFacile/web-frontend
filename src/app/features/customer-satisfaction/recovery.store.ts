import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CsAssignPayload,
  CsListFilters,
  CsLookups,
  CsPageMeta,
  CsRecoveryCase,
  CsTransitionPayload,
  CustomerSatisfactionApiService,
} from '@core';
import { CS_OK, CsOutcome, failureOf } from './customer-satisfaction.util';

export interface RecoveryState {
  cases: CsRecoveryCase[];
  meta: CsPageMeta | null;
  filters: CsListFilters;
  lookups: CsLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The closed-loop detractor recovery queue: filter, take over, move through the workflow and log the resolution. */
export const RecoveryStore = signalStore(
  withState<RecoveryState>({
    cases: [],
    meta: null,
    filters: { open_only: true },
    lookups: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(CustomerSatisfactionApiService)) => {
    const load = async (filters?: CsListFilters): Promise<void> => {
      const active = filters ?? store.filters();
      patchState(store, { filters: active, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listRecoveryCases(active));
        patchState(store, { cases: response.data, meta: response.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<CsOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return CS_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      loadLookups: async (): Promise<void> => {
        if (store.lookups() !== null) {
          return;
        }
        try {
          patchState(store, { lookups: (await firstValueFrom(api.getLookups())).data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      transition: (id: string, payload: CsTransitionPayload): Promise<CsOutcome> =>
        write(() => firstValueFrom(api.transitionRecoveryCase(id, payload))),
      assign: (id: string, payload: CsAssignPayload): Promise<CsOutcome> =>
        write(() => firstValueFrom(api.assignRecoveryCase(id, payload))),
    };
  }),
);
