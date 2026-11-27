import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SctDashboard, SctDashboardFilters, SubcontractingApiService } from '@core';
import { failureOf } from './subcontracting.util';

export interface DashboardState {
  dashboard: SctDashboard | null;
  filters: SctDashboardFilters;
  loading: boolean;
  error: string | null;
}

/** The stock held by partners: KPIs, the matrix of partner / product / order with aging and the one-year deadline. */
export const DashboardStore = signalStore(
  withState<DashboardState>({ dashboard: null, filters: {}, loading: false, error: null }),
  withMethods((store, api = inject(SubcontractingApiService)) => ({
    load: async (filters?: SctDashboardFilters): Promise<void> => {
      const active = filters ?? store.filters();
      patchState(store, { filters: active, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getDashboard(active));
        patchState(store, { dashboard: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
  })),
);
