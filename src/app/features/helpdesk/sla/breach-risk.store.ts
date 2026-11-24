import { computed, inject } from '@angular/core';
import {
  BreachRiskTicket,
  HelpdeskMetrics,
  HelpdeskMetricsParams,
  HelpdeskSlaApiService,
  MetricsGroupBy,
} from '@core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';

export interface BreachRiskState {
  tickets: BreachRiskTicket[];
  riskPercent: number;
  priorityFilter: string;
  statusFilter: string;
  queueFilter: string;
  metrics: HelpdeskMetrics | null;
  metricsGroupBy: MetricsGroupBy;
  loading: boolean;
  metricsLoading: boolean;
  failed: boolean;
  metricsFailed: boolean;
}

const initialState: BreachRiskState = {
  tickets: [],
  riskPercent: 75,
  priorityFilter: '',
  statusFilter: '',
  queueFilter: '',
  metrics: null,
  metricsGroupBy: 'queue',
  loading: false,
  metricsLoading: false,
  failed: false,
  metricsFailed: false,
};

/** Tickets that are about to breach an SLA target (or already did), and the helpdesk SLA metrics. */
export const BreachRiskStore = signalStore(
  withState(initialState),
  withComputed(({ tickets, priorityFilter, statusFilter, queueFilter }) => {
    const visible = computed(() =>
      tickets().filter(
        (ticket) =>
          (!priorityFilter() || ticket.priority === priorityFilter()) &&
          (!statusFilter() || ticket.status === statusFilter()) &&
          (!queueFilter() || ticket.assigned_team_id === queueFilter()),
      ),
    );

    return {
      visible,
      breachedCount: computed(
        () =>
          visible().filter((ticket) => ticket.targets.some((target) => target.state === 'breached'))
            .length,
      ),
      /** Teams present in the queue, the options of the queue filter. */
      queues: computed(() => [
        ...new Set(
          tickets()
            .map((ticket) => ticket.assigned_team_id)
            .filter((id): id is string => !!id),
        ),
      ]),
    };
  }),
  withMethods((store, api = inject(HelpdeskSlaApiService)) => ({
    setFilters(
      filters: Partial<
        Pick<BreachRiskState, 'priorityFilter' | 'statusFilter' | 'queueFilter' | 'riskPercent'>
      >,
    ): void {
      patchState(store, filters);
    },

    load(limit = 100): Observable<BreachRiskTicket[]> {
      patchState(store, { loading: true, failed: false });

      return api.getBreachRisk({ risk_percent: store.riskPercent(), limit }).pipe(
        map((res) => res.data ?? []),
        tap((tickets) => patchState(store, { tickets })),
        catchError(() => {
          patchState(store, { failed: true, tickets: [] });
          return of([] as BreachRiskTicket[]);
        }),
        finalize(() => patchState(store, { loading: false })),
      );
    },

    loadMetrics(params: HelpdeskMetricsParams = {}): Observable<HelpdeskMetrics | null> {
      const groupBy = params.group_by ?? store.metricsGroupBy();
      patchState(store, { metricsLoading: true, metricsFailed: false, metricsGroupBy: groupBy });

      return api.getMetrics({ ...params, group_by: groupBy }).pipe(
        map((res) => res.data ?? null),
        tap((metrics) => patchState(store, { metrics })),
        catchError(() => {
          patchState(store, { metricsFailed: true, metrics: null });
          return of(null);
        }),
        finalize(() => patchState(store, { metricsLoading: false })),
      );
    },
  })),
);
