import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { GdoTradeTermsApiService, GdtDashboard } from '@core';
import { failureOf } from './gdo-trade-terms.util';

export interface DashboardState {
  data: GdtDashboard | null;
  loading: boolean;
  error: string | null;
}

/** The overview of the GDO trade terms: contracts by status, accrued and unsettled, settlements and projections. */
export const DashboardStore = signalStore(
  withState<DashboardState>({ data: null, loading: false, error: null }),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => ({
    async load(asOf?: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getDashboard(asOf));
        patchState(store, { data: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
  })),
);
