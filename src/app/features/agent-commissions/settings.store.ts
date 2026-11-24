import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AgcFiscalOverridePayload,
  AgcFiscalParameter,
  AgcZone,
  AgcZonePayload,
  AgentCommissionsApiService,
} from '@core';
import { AGC_OK, AgcOutcome, failureOf } from './agent-commissions.util';

export interface SettingsState {
  zones: AgcZone[];
  parameters: AgcFiscalParameter[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  zones: [],
  parameters: [],
  loading: false,
  saving: false,
  error: null,
};

/** Commission zones and the fiscal parameters (statutory values with the overrides of the company). */
export const SettingsStore = signalStore(
  withState(initialState),
  withComputed(({ parameters }) => ({
    /** Company overrides first inside each code, so the table shows what the engine actually uses on top. */
    sortedParameters: computed(() =>
      [...parameters()].sort(
        (a, b) =>
          a.code.localeCompare(b.code) ||
          (a.mandate_type ?? '').localeCompare(b.mandate_type ?? '') ||
          (b.year ?? 0) - (a.year ?? 0) ||
          Number(b.is_override) - Number(a.is_override),
      ),
    ),
  })),
  withMethods((store, api = inject(AgentCommissionsApiService)) => {
    const loadZones = async (): Promise<void> => {
      const response = await firstValueFrom(api.listZones());
      patchState(store, { zones: response.data });
    };

    const loadParameters = async (): Promise<void> => {
      const response = await firstValueFrom(api.listFiscalParameters());
      patchState(store, { parameters: response.data });
    };

    const write = async (call: () => Promise<void>): Promise<AgcOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        return AGC_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          await Promise.all([loadZones(), loadParameters()]);
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      },
      saveZone(id: string | null, payload: AgcZonePayload): Promise<AgcOutcome> {
        return write(async () => {
          await firstValueFrom(id ? api.updateZone(id, payload) : api.createZone(payload));
          await loadZones();
        });
      },
      removeZone(id: string): Promise<AgcOutcome> {
        return write(async () => {
          await firstValueFrom(api.deleteZone(id));
          patchState(store, { zones: store.zones().filter((zone) => zone.id !== id) });
        });
      },
      /** Saves the override of a parameter for the company (upsert), then reads the table again. */
      saveOverride(payload: AgcFiscalOverridePayload): Promise<AgcOutcome> {
        return write(async () => {
          await firstValueFrom(api.saveFiscalOverride(payload));
          await loadParameters();
        });
      },
      /** Removes the override: the statutory value applies again. */
      removeOverride(id: string): Promise<AgcOutcome> {
        return write(async () => {
          await firstValueFrom(api.deleteFiscalOverride(id));
          await loadParameters();
        });
      },
    };
  }),
);
