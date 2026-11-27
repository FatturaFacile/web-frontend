import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { DistributionApiService, DstDashboard } from '@core';
import { failureOf } from './distribution.util';

export interface OverviewState {
  dashboard: DstDashboard | null;
  loading: boolean;
  error: string | null;
}

/** The distribution overview: transfers and goods in transit, proposals, stockout alerts and consignment stock. */
export const OverviewStore = signalStore(
  withState<OverviewState>({ dashboard: null, loading: false, error: null }),
  withMethods((store, api = inject(DistributionApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getDashboard());
        patchState(store, { dashboard: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
  })),
);
