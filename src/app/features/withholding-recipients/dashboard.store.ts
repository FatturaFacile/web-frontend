import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  WithholdingRecipientsApiService,
  WrDashboardFilters,
  WrDashboardMeta,
  WrDashboardRow,
  WrJurisdiction,
  WrLookups,
  WrRegime,
} from '@core';
import { failureOf } from './withholding-recipients.util';

export interface DashboardState {
  rows: WrDashboardRow[];
  meta: WrDashboardMeta | null;
  lookups: WrLookups | null;
  regime: WrRegime | null;
  jurisdiction: WrJurisdiction | null;
  cuCausal: string | null;
  search: string;
  year: number;
  onlyAlerts: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  rows: [],
  meta: null,
  lookups: null,
  regime: null,
  jurisdiction: null,
  cuCausal: null,
  search: '',
  year: new Date().getFullYear(),
  onlyAlerts: false,
  loading: false,
  error: null,
};

/** The recipients dashboard: the year-to-date figures, the threshold progress and the alerts of every recipient. */
export const DashboardStore = signalStore(
  withState(initialState),
  withComputed(({ regime, jurisdiction, cuCausal, search, year, onlyAlerts, rows }) => ({
    filters: computed<WrDashboardFilters>(() => ({
      regime: regime(),
      jurisdiction: jurisdiction(),
      cu_causal: cuCausal(),
      search: search().trim() === '' ? null : search().trim(),
      year: year(),
      only_alerts: onlyAlerts(),
    })),
    hasRows: computed(() => rows().length > 0),
  })),
  withMethods((store, api = inject(WithholdingRecipientsApiService)) => {
    let sequence = 0;

    const load = async (): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getDashboard(store.filters()));
        if (ticket === sequence) {
          patchState(store, {
            rows: response.data,
            meta: (response.meta as WrDashboardMeta | undefined) ?? null,
            loading: false,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    return {
      load,
      async loadLookups(): Promise<void> {
        try {
          const response = await firstValueFrom(api.getLookups());
          patchState(store, { lookups: response.data });
        } catch (error) {
          patchState(store, { error: (await failureOf(error)).errorKey });
        }
      },
      /** Applies a change of the filters and reads the dashboard again. */
      async setFilters(
        change: Partial<Omit<DashboardState, 'rows' | 'meta' | 'lookups' | 'loading' | 'error'>>,
      ): Promise<void> {
        patchState(store, change);
        await load();
      },
      async resetFilters(): Promise<void> {
        patchState(store, {
          regime: null,
          jurisdiction: null,
          cuCausal: null,
          search: '',
          onlyAlerts: false,
        });
        await load();
      },
      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
