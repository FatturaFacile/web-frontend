import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { FranchiseNetworkApiService, FrnAgreement, FrnDashboard, FrnLookups } from '@core';
import { defaultPeriod, failureOf } from './franchise-network.util';

export interface CommandState {
  period: string;
  dashboard: FrnDashboard | null;
  alerts: FrnAgreement[];
  lookups: FrnLookups | null;
  loading: boolean;
  error: string | null;
}

/** The franchisor command view: network KPIs of the month, the agreements that need attention and the role of the company. */
export const CommandStore = signalStore(
  withState<CommandState>({
    period: defaultPeriod(),
    dashboard: null,
    alerts: [],
    lookups: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => ({
    async load(period?: string): Promise<void> {
      const month = period ?? store.period();
      patchState(store, { loading: true, error: null, period: month });
      try {
        const lookups = await firstValueFrom(api.getLookups());
        patchState(store, { lookups: lookups.data });

        if (!lookups.data.role.can_manage) {
          patchState(store, { loading: false, dashboard: null, alerts: [] });
          return;
        }

        const [dashboard, alerts] = await Promise.all([
          firstValueFrom(api.getDashboard(month)),
          firstValueFrom(api.getAgreementAlerts()),
        ]);
        patchState(store, { dashboard: dashboard.data, alerts: alerts.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
  })),
);
