import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ObservabilityApiService } from '../../core/api/observability-api.service';
import {
  ObsNoisyNeighbor,
  ObsProfilerSettings,
  ObsSlowEndpoint,
  ObsSlowQuery,
  ObsStatements,
} from '../../core/models/observability.model';
import { failureKey } from './observability.util';

export interface ProfilerState {
  slowQueries: ObsSlowQuery[];
  slowEndpoints: ObsSlowEndpoint[];
  statements: ObsStatements | null;
  noisyNeighbors: ObsNoisyNeighbor[];
  settings: ObsProfilerSettings | null;
  selectedFingerprint: string | null;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

/** State of the Performance Profiler & Slow Query Inspector (platform administrators). */
export const ProfilerStore = signalStore(
  withState<ProfilerState>({
    slowQueries: [],
    slowEndpoints: [],
    statements: null,
    noisyNeighbors: [],
    settings: null,
    selectedFingerprint: null,
    loading: false,
    saving: false,
    saved: false,
    error: null,
  }),
  withComputed((store) => ({
    selectedQuery: computed<ObsSlowQuery | null>(
      () => store.slowQueries().find((query) => query.fingerprint === store.selectedFingerprint()) ?? null,
    ),
    nPlusOneCount: computed(() => store.slowQueries().filter((query) => query.n_plus_one).length),
    slowestQueryMs: computed(() => Math.max(0, ...store.slowQueries().map((query) => query.max_ms))),
    slowestEndpointP95: computed(() => Math.max(0, ...store.slowEndpoints().map((endpoint) => endpoint.p95_ms))),
    suggestedIndexCount: computed(() =>
      store.slowQueries().reduce((total, query) => total + query.suggested_indexes.length, 0),
    ),
    flaggedTenants: computed(() => store.noisyNeighbors().filter((tenant) => tenant.flagged).length),
  })),
  withMethods((store, api = inject(ObservabilityApiService)) => ({
    /** Loads the five datasets together; one failing call does not hide the others. */
    loadAll: async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      const [queries, endpoints, statements, neighbors, settings] = await Promise.allSettled([
        firstValueFrom(api.slowQueries()),
        firstValueFrom(api.slowEndpoints()),
        firstValueFrom(api.statements()),
        firstValueFrom(api.noisyNeighbors()),
        firstValueFrom(api.getSettings()),
      ]);
      const failed = [queries, endpoints, statements, neighbors, settings].find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      patchState(store, {
        slowQueries: queries.status === 'fulfilled' ? queries.value.data : [],
        slowEndpoints: endpoints.status === 'fulfilled' ? endpoints.value.data : [],
        statements: statements.status === 'fulfilled' ? statements.value.data : null,
        noisyNeighbors: neighbors.status === 'fulfilled' ? neighbors.value.data : [],
        settings: settings.status === 'fulfilled' ? settings.value.data : store.settings(),
        loading: false,
        error: failed ? failureKey(failed.reason) : null,
      });
    },
    select: (fingerprint: string | null): void => patchState(store, { selectedFingerprint: fingerprint }),
    saveSettings: async (settings: ObsProfilerSettings): Promise<boolean> => {
      patchState(store, { saving: true, saved: false, error: null });
      try {
        const response = await firstValueFrom(api.saveSettings(settings));
        patchState(store, { settings: response.data, saving: false, saved: true });
        return true;
      } catch (error) {
        patchState(store, { saving: false, error: failureKey(error) });
        return false;
      }
    },
  })),
);
