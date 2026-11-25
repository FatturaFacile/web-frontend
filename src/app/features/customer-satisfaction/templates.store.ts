import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CsListFilters,
  CsLookups,
  CsTemplate,
  CsTemplatePayload,
  CustomerSatisfactionApiService,
} from '@core';
import { CS_OK, CsOutcome, failureOf } from './customer-satisfaction.util';

export interface TemplatesState {
  templates: CsTemplate[];
  lookups: CsLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** NPS / CSAT / CES templates with their ERP trigger rule, channels, cooldown, SLA and localized texts. */
export const TemplatesStore = signalStore(
  withState<TemplatesState>({
    templates: [],
    lookups: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(CustomerSatisfactionApiService)) => {
    const load = async (filters: CsListFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listTemplates(filters));
        patchState(store, { templates: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<CsOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return CS_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
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
      save: (payload: CsTemplatePayload, id?: string): Promise<CsOutcome> =>
        write(() =>
          firstValueFrom(id ? api.updateTemplate(id, payload) : api.createTemplate(payload)),
        ),
      toggleActive: (template: CsTemplate): Promise<CsOutcome> =>
        write(() =>
          firstValueFrom(api.updateTemplate(template.id, { is_active: !template.is_active })),
        ),
      remove: (id: string): Promise<CsOutcome> =>
        write(() => firstValueFrom(api.deleteTemplate(id))),
      installDefaults: (): Promise<CsOutcome> =>
        write(() => firstValueFrom(api.installDefaultTemplates())),
    };
  }),
);
