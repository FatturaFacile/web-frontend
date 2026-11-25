import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CsAnalyticsFilters,
  CsBreakdownRow,
  CsGranularity,
  CsGroupBy,
  CsLookups,
  CsOverview,
  CsReport,
  CsReportFormat,
  CsReportPayload,
  CsSentiment,
  CsTrendRow,
  CustomerSatisfactionApiService,
} from '@core';
import { CS_OK, CsOutcome, failureOf } from './customer-satisfaction.util';

export interface AnalyticsState {
  filters: CsAnalyticsFilters;
  groupBy: CsGroupBy;
  granularity: CsGranularity;
  overview: CsOverview | null;
  breakdown: CsBreakdownRow[];
  trend: CsTrendRow[];
  sentiment: CsSentiment | null;
  reports: CsReport[];
  lookups: CsLookups | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
}

/** The executive dashboard: ISO 9001 § 9.1.2 KPIs, breakdown by dimension, trend, sentiment and the Management Review reports. */
export const AnalyticsStore = signalStore(
  withState<AnalyticsState>({
    filters: {},
    groupBy: 'department',
    granularity: 'month',
    overview: null,
    breakdown: [],
    trend: [],
    sentiment: null,
    reports: [],
    lookups: null,
    loading: false,
    generating: false,
    error: null,
  }),
  withMethods((store, api = inject(CustomerSatisfactionApiService)) => {
    const loadAll = async (filters?: CsAnalyticsFilters): Promise<void> => {
      const active = filters ?? store.filters();
      patchState(store, { filters: active, loading: true, error: null });
      try {
        const [overview, breakdown, trend, sentiment, reports] = await Promise.all([
          firstValueFrom(api.getOverview(active)),
          firstValueFrom(api.getBreakdown(store.groupBy(), active)),
          firstValueFrom(api.getTrend(store.granularity(), active)),
          firstValueFrom(api.getSentiment(active)),
          firstValueFrom(api.listReports()),
        ]);
        patchState(store, {
          overview: overview.data,
          breakdown: breakdown.data.rows,
          trend: trend.data.rows,
          sentiment: sentiment.data,
          reports: reports.data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      loadAll,
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
      setGroupBy: async (groupBy: CsGroupBy): Promise<void> => {
        patchState(store, { groupBy });
        try {
          const response = await firstValueFrom(api.getBreakdown(groupBy, store.filters()));
          patchState(store, { breakdown: response.data.rows });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      setGranularity: async (granularity: CsGranularity): Promise<void> => {
        patchState(store, { granularity });
        try {
          const response = await firstValueFrom(api.getTrend(granularity, store.filters()));
          patchState(store, { trend: response.data.rows });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      generateReport: async (payload: CsReportPayload): Promise<CsOutcome & { id?: string }> => {
        patchState(store, { generating: true });
        try {
          const response = await firstValueFrom(api.generateReport(payload));
          patchState(store, {
            generating: false,
            reports: [response.data, ...store.reports()],
          });
          return { ...CS_OK, id: response.data.id };
        } catch (error) {
          patchState(store, { generating: false });
          return failureOf(error);
        }
      },
      exportReport: async (
        id: string,
        format: CsReportFormat,
      ): Promise<{ outcome: CsOutcome; blob: Blob | null }> => {
        try {
          return { outcome: CS_OK, blob: await firstValueFrom(api.exportReport(id, format)) };
        } catch (error) {
          return { outcome: failureOf(error), blob: null };
        }
      },
    };
  }),
);
