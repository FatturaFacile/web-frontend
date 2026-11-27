import { computed, DestroyRef, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ObservabilityApiService } from '../../core/api/observability-api.service';
import { ObsConnector, ObsConnectorStatus } from '../../core/models/observability.model';
import { failureKey, statusSignature } from './observability.util';

export const CONNECTOR_STATUS_POLL_MS = 60_000;
export const DISMISSED_STORAGE_KEY = 'ff.connector-status.dismissed';

export interface ConnectorStatusState {
  overall: ObsConnectorStatus;
  checkedAt: string | null;
  connectors: ObsConnector[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  /** Signature of the problem the user dismissed in this session. */
  dismissedSignature: string | null;
}

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Health of the institutional connectors as every member sees it. The shell banner and the status page share it; the poll runs
 * only while someone watches (`startPolling`) and pauses while the browser tab is hidden.
 */
export const ConnectorStatusStore = signalStore(
  { providedIn: 'root' },
  // A factory, so every store instance reads the dismissal of the session when it is created.
  withState<ConnectorStatusState>(() => ({
    overall: 'operational',
    checkedAt: null,
    connectors: [],
    loaded: false,
    loading: false,
    error: null,
    dismissedSignature: readDismissed(),
  })),
  withComputed((store) => ({
    signature: computed(() => statusSignature(store.connectors())),
    affected: computed(() => store.connectors().filter((connector) => connector.status !== 'operational')),
  })),
  withComputed((store) => ({
    /** The banner shows while something is not operational and the user has not dismissed this very situation. */
    bannerVisible: computed(
      () =>
        store.loaded() &&
        store.overall() !== 'operational' &&
        store.signature() !== '' &&
        store.signature() !== store.dismissedSignature(),
    ),
  })),
  withMethods((store, api = inject(ObservabilityApiService), destroyRef = inject(DestroyRef)) => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let visibilityListener: (() => void) | null = null;

    const refresh = async (): Promise<void> => {
      if (store.loading()) {
        return;
      }
      patchState(store, { loading: true });
      try {
        const response = await firstValueFrom(api.connectorStatus());
        patchState(store, {
          overall: response.data.overall,
          checkedAt: response.data.checked_at,
          connectors: response.data.connectors,
          loaded: true,
          loading: false,
          error: null,
        });
      } catch (error) {
        // The banner is informational: a failed poll keeps the last known state and never raises an alert of its own.
        patchState(store, { loading: false, error: failureKey(error) });
      }
    };

    const stopPolling = (): void => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      if (visibilityListener) {
        document.removeEventListener('visibilitychange', visibilityListener);
        visibilityListener = null;
      }
    };

    destroyRef.onDestroy(stopPolling);

    return {
      refresh,
      stopPolling,
      /** Loads now and every 60 s; the interval pauses while the tab is hidden and catches up when it returns. */
      startPolling: (): void => {
        if (timer !== null) {
          return;
        }
        void refresh();
        const tick = (): void => {
          if (!document.hidden) {
            void refresh();
          }
        };
        timer = setInterval(tick, CONNECTOR_STATUS_POLL_MS);
        visibilityListener = (): void => {
          if (!document.hidden) {
            void refresh();
          }
        };
        document.addEventListener('visibilitychange', visibilityListener);
      },
      dismiss: (): void => {
        const signature = store.signature();
        patchState(store, { dismissedSignature: signature });
        try {
          sessionStorage.setItem(DISMISSED_STORAGE_KEY, signature);
        } catch {
          // Private mode: the dismissal then lasts until the page reloads.
        }
      },
    };
  }),
);
