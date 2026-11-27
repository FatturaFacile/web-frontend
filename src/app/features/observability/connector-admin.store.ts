import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ObservabilityApiService } from '../../core/api/observability-api.service';
import { ObsConnector } from '../../core/models/observability.model';
import { failureKey } from './observability.util';

export interface ConnectorAdminState {
  connectors: ObsConnector[];
  loading: boolean;
  probing: boolean;
  error: string | null;
}

/** Detail view of the connectors for platform administrators: last error, TLS expiry, probe now, maintenance windows. */
export const ConnectorAdminStore = signalStore(
  withState<ConnectorAdminState>({ connectors: [], loading: false, probing: false, error: null }),
  withMethods((store, api = inject(ObservabilityApiService)) => ({
    load: async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.connectors());
        patchState(store, { connectors: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureKey(error) });
      }
    },
    /** Runs the synthetic probe now for one connector or for all of them and shows the fresh state. */
    probe: async (key?: string): Promise<void> => {
      patchState(store, { probing: true, error: null });
      try {
        const response = await firstValueFrom(api.probe(key));
        const fresh = new Map(response.data.map((connector) => [connector.key, connector]));
        patchState(store, {
          connectors: store.connectors().map((connector) => fresh.get(connector.key) ?? connector),
          probing: false,
        });
      } catch (error) {
        patchState(store, { probing: false, error: failureKey(error) });
      }
    },
    setMaintenance: async (key: string, maintenance: boolean, message?: string): Promise<void> => {
      patchState(store, { error: null });
      try {
        const response = await firstValueFrom(api.setMaintenance(key, maintenance, message));
        patchState(store, {
          connectors: store.connectors().map((connector) => (connector.key === key ? response.data : connector)),
        });
      } catch (error) {
        patchState(store, { error: failureKey(error) });
      }
    },
  })),
);
