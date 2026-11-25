import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  TenderManagementApiService,
  TndLookups,
  TndVaultDocument,
  TndVaultOverview,
  TndVaultPayload,
} from '@core';
import { failureOf, TND_OK, TndOutcome } from './tender-management.util';

export interface VaultState {
  overview: TndVaultOverview | null;
  lookups: TndLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: VaultState = {
  overview: null,
  lookups: null,
  loading: false,
  saving: false,
  error: null,
};

/** The company qualification vault: documents by country with their validity, uploads, renewals and the FVOE sync. */
export const VaultStore = signalStore(
  withState(initialState),
  withComputed(({ overview, lookups }) => ({
    it: computed(() => overview()?.it ?? null),
    ch: computed(() => overview()?.ch ?? null),
    fvoe: computed(() => overview()?.fvoe ?? { synced: 0, total: 0 }),
    typesFor: computed(() => (country: 'IT' | 'CH') =>
      (lookups()?.vault_doc_types ?? []).filter((type) => type.jurisdiction === country),
    ),
    soaCategories: computed(() => lookups()?.soa_categories ?? []),
    soaClassifications: computed(() => lookups()?.soa_classifications ?? []),
  })),
  withMethods((store, api = inject(TenderManagementApiService)) => {
    const refresh = async (): Promise<void> => {
      const overview = await firstValueFrom(api.getVaultOverview());
      patchState(store, { overview: overview.data });
    };

    const wrap = async (action: () => Promise<void>): Promise<TndOutcome> => {
      patchState(store, { saving: true });
      try {
        await action();
        await refresh();
        patchState(store, { saving: false });
        return TND_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [overview, lookups] = await Promise.all([
            firstValueFrom(api.getVaultOverview()),
            firstValueFrom(api.getLookups()).catch(() => null),
          ]);
          patchState(store, { overview: overview.data, lookups: lookups?.data ?? null, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      },
      create(payload: TndVaultPayload): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.createVaultDocument(payload));
        });
      },
      update(doc: TndVaultDocument, payload: TndVaultPayload): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.updateVaultDocument(doc.id, payload));
        });
      },
      renew(doc: TndVaultDocument, payload: TndVaultPayload): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.renewVaultDocument(doc.id, payload));
        });
      },
      remove(doc: TndVaultDocument): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.deleteVaultDocument(doc.id));
        });
      },
      syncFvoe(doc: TndVaultDocument): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.syncFvoe(doc.id));
        });
      },
    };
  }),
);
