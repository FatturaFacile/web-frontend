import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ElectronicSignatureApiService,
  EsigConnectionTest,
  EsigLookups,
  EsigProviderConfig,
  EsigProviderPayload,
  EsigTemplate,
  EsigTemplatePayload,
} from '@core';
import { ESIG_OK, EsigOutcome, failureOf } from './e-signature.util';

export interface SignatureSettingsState {
  providers: EsigProviderConfig[];
  templates: EsigTemplate[];
  lookups: EsigLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Result of the last connection test, by configuration id. */
  tests: Record<string, EsigConnectionTest>;
  testing: string | null;
}

const initialState: SignatureSettingsState = {
  providers: [],
  templates: [],
  lookups: null,
  loading: false,
  saving: false,
  error: null,
  tests: {},
  testing: null,
};

/** Provider configurations (credentials stay on the server) and the compliance templates of the company. */
export const SignatureSettingsStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(ElectronicSignatureApiService)) => {
    const loadProviders = async (): Promise<void> => {
      patchState(store, { providers: (await firstValueFrom(api.listProviders())).data });
    };
    const loadTemplates = async (): Promise<void> => {
      patchState(store, { templates: (await firstValueFrom(api.listTemplates())).data });
    };

    const write = async (call: () => Promise<void>): Promise<EsigOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        return ESIG_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [lookups] = await Promise.all([
            firstValueFrom(api.getLookups()),
            loadProviders(),
            loadTemplates(),
          ]);
          patchState(store, { lookups: lookups.data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      },
      saveProvider(id: string | null, payload: EsigProviderPayload): Promise<EsigOutcome> {
        return write(async () => {
          await firstValueFrom(id ? api.updateProvider(id, payload) : api.createProvider(payload));
          await loadProviders();
        });
      },
      removeProvider(id: string): Promise<EsigOutcome> {
        return write(async () => {
          await firstValueFrom(api.deleteProvider(id));
          patchState(store, {
            providers: store.providers().filter((provider) => provider.id !== id),
          });
        });
      },
      async testProvider(id: string): Promise<EsigOutcome> {
        patchState(store, { testing: id });
        try {
          const result = (await firstValueFrom(api.testProvider(id))).data;
          patchState(store, {
            testing: null,
            tests: { ...store.tests(), [id]: result },
            providers: store
              .providers()
              .map((provider) => (provider.id === id ? result.config : provider)),
          });
          return ESIG_OK;
        } catch (error) {
          patchState(store, { testing: null });
          return failureOf(error);
        }
      },
      saveTemplate(id: string | null, payload: EsigTemplatePayload): Promise<EsigOutcome> {
        return write(async () => {
          await firstValueFrom(id ? api.updateTemplate(id, payload) : api.createTemplate(payload));
          await loadTemplates();
        });
      },
      removeTemplate(id: string): Promise<EsigOutcome> {
        return write(async () => {
          await firstValueFrom(api.deleteTemplate(id));
          patchState(store, {
            templates: store.templates().filter((template) => template.id !== id),
          });
        });
      },
    };
  }),
);
