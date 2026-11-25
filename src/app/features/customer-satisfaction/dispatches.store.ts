import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CsDispatch,
  CsListFilters,
  CsLookups,
  CsPageMeta,
  CsResponse,
  CustomerSatisfactionApiService,
} from '@core';
import { CS_OK, CsOutcome, failureOf } from './customer-satisfaction.util';

export interface DispatchesState {
  dispatches: CsDispatch[];
  dispatchMeta: CsPageMeta | null;
  responses: CsResponse[];
  responseMeta: CsPageMeta | null;
  lookups: CsLookups | null;
  loading: boolean;
  processing: boolean;
  error: string | null;
}

/** The dispatch monitor (status, throttle reason) and the log of the answers with their text and voice comments. */
export const DispatchesStore = signalStore(
  withState<DispatchesState>({
    dispatches: [],
    dispatchMeta: null,
    responses: [],
    responseMeta: null,
    lookups: null,
    loading: false,
    processing: false,
    error: null,
  }),
  withMethods((store, api = inject(CustomerSatisfactionApiService)) => ({
    loadDispatches: async (filters: CsListFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listDispatches(filters));
        patchState(store, {
          dispatches: response.data,
          dispatchMeta: response.meta ?? null,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    loadResponses: async (filters: CsListFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listResponses(filters));
        patchState(store, {
          responses: response.data,
          responseMeta: response.meta ?? null,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
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
    processDue: async (): Promise<CsOutcome & { sent?: number; failed?: number }> => {
      patchState(store, { processing: true });
      try {
        const response = await firstValueFrom(api.processDispatches());
        patchState(store, { processing: false });
        return { ...CS_OK, sent: response.data.sent, failed: response.data.failed };
      } catch (error) {
        patchState(store, { processing: false });
        return failureOf(error);
      }
    },
    loadVoice: async (responseId: string): Promise<Blob | null> => {
      try {
        return await firstValueFrom(api.getVoice(responseId));
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
        return null;
      }
    },
  })),
);
