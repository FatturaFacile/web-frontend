import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  EbillConnectionResult,
  EbillSettings,
  EbillSettingsPayload,
  SwissEbillApiService,
} from '@core';
import { EBILL_OK, EbillOutcome, failureOf } from './swiss-ebill.util';

export interface EbillSettingsState {
  settings: EbillSettings | null;
  connection: EbillConnectionResult | null;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  error: string | null;
}

/** The tenant settings: biller enrollment, credentials, webhook secret and the connection test. */
export const EbillSettingsStore = signalStore(
  withState<EbillSettingsState>({
    settings: null,
    connection: null,
    loading: false,
    saving: false,
    testing: false,
    error: null,
  }),
  withMethods((store, api = inject(SwissEbillApiService)) => ({
    load: async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        patchState(store, {
          settings: (await firstValueFrom(api.getSettings())).data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    save: async (payload: EbillSettingsPayload): Promise<EbillOutcome> => {
      patchState(store, { saving: true });
      try {
        const response = await firstValueFrom(api.saveSettings(payload));
        patchState(store, { settings: response.data, saving: false });
        return EBILL_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    },
    testConnection: async (): Promise<EbillOutcome> => {
      patchState(store, { testing: true });
      try {
        const response = await firstValueFrom(api.testConnection());
        patchState(store, {
          settings: response.data.settings,
          connection: response.data.result,
          testing: false,
        });
        return EBILL_OK;
      } catch (error) {
        patchState(store, { testing: false });
        return failureOf(error);
      }
    },
    rotateSecret: async (): Promise<EbillOutcome> => {
      try {
        patchState(store, { settings: (await firstValueFrom(api.rotateWebhookSecret())).data });
        return EBILL_OK;
      } catch (error) {
        return failureOf(error);
      }
    },
  })),
);
