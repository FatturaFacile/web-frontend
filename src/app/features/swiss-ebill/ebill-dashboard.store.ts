import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  EbillDashboard,
  EbillPageMeta,
  EbillTransmission,
  EbillTransmissionFilters,
  SwissEbillApiService,
} from '@core';
import { EBILL_OK, EbillOutcome, failureOf } from './swiss-ebill.util';

export interface EbillDashboardState {
  kpis: EbillDashboard | null;
  transmissions: EbillTransmission[];
  meta: EbillPageMeta | null;
  loading: boolean;
  error: string | null;
}

/** KPI cards and the filterable transmission log of the monitoring dashboard. */
export const EbillDashboardStore = signalStore(
  withState<EbillDashboardState>({
    kpis: null,
    transmissions: [],
    meta: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(SwissEbillApiService)) => ({
    load: async (filters: EbillTransmissionFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [kpis, list] = await Promise.all([
          firstValueFrom(api.getDashboard(filters.from, filters.to)),
          firstValueFrom(api.listTransmissions(filters)),
        ]);
        patchState(store, {
          kpis: kpis.data,
          transmissions: list.data,
          meta: list.meta ?? null,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    retry: async (id: string): Promise<EbillOutcome> => {
      try {
        await firstValueFrom(api.retryTransmission(id));
        return EBILL_OK;
      } catch (error) {
        return failureOf(error);
      }
    },
    cancel: async (id: string): Promise<EbillOutcome> => {
      try {
        await firstValueFrom(api.cancelTransmission(id));
        return EBILL_OK;
      } catch (error) {
        return failureOf(error);
      }
    },
    detail: async (id: string): Promise<EbillTransmission | null> => {
      try {
        return (await firstValueFrom(api.getTransmission(id))).data;
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
        return null;
      }
    },
    download: async (id: string): Promise<Blob | null> => {
      try {
        return await firstValueFrom(api.downloadPayload(id));
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
        return null;
      }
    },
  })),
);
