import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  FranchiseNetworkApiService,
  FrnAction,
  FrnAudit,
  FrnStore,
  FrnTemplate,
} from '@core';
import { failureOf, FRN_OK, FrnOutcome } from './franchise-network.util';

export interface AuditsState {
  audits: FrnAudit[];
  actions: FrnAction[];
  stores: FrnStore[];
  templates: FrnTemplate[];
  storeFilter: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Audit history of the stores, the checklist templates and the open corrective actions (an area manager sees their own stores). */
export const AuditsStore = signalStore(
  withState<AuditsState>({
    audits: [],
    actions: [],
    stores: [],
    templates: [],
    storeFilter: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const storeId = store.storeFilter() ?? undefined;
        const [audits, actions, lookups] = await Promise.all([
          firstValueFrom(api.listAudits({ store_id: storeId })),
          firstValueFrom(api.listAuditActions({ status: 'open', store_id: storeId })),
          firstValueFrom(api.getLookups()),
        ]);
        patchState(store, {
          audits: audits.data,
          actions: actions.data,
          stores: lookups.data.stores,
          templates: lookups.data.audit_templates,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      load,
      setStoreFilter(storeId: string | null): Promise<void> {
        patchState(store, { storeFilter: storeId });
        return load();
      },
      async start(payload: {
        store_id: string;
        template_id: string;
        audited_on?: string | null;
      }): Promise<{ outcome: FrnOutcome; audit: FrnAudit | null }> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.startAudit(payload));
          patchState(store, { saving: false });
          return { outcome: FRN_OK, audit: response.data };
        } catch (error) {
          patchState(store, { saving: false });
          return { outcome: failureOf(error), audit: null };
        }
      },
      async completeAction(id: string, note: string | null): Promise<FrnOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.completeAuditAction(id, note));
          patchState(store, { saving: false });
          await load();
          return FRN_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
    };
  }),
);
