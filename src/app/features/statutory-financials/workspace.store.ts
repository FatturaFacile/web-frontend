import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  SfCashFlowMethod,
  SfDossier,
  SfLocale,
  SfLookups,
  SfTransitionTarget,
  StatutoryFinancialsApiService,
} from '@core';
import {
  failureOf,
  isEditable,
  isLocked,
  jurisdictionOf,
  lifecycleActions,
  SF_OK,
  SfOutcome,
  scaleOfMode,
} from './statutory-financials.util';

export interface WorkspaceState {
  id: string | null;
  dossier: SfDossier | null;
  lookups: SfLookups | null;
  loading: boolean;
  /** A write is running (generate, transition): the buttons wait. */
  busy: boolean;
  error: string | null;
}

/** The dossier open in the workspace, shared by its tabs: detail, lookups and the lifecycle. */
export const WorkspaceStore = signalStore(
  withState<WorkspaceState>({
    id: null,
    dossier: null,
    lookups: null,
    loading: false,
    busy: false,
    error: null,
  }),
  withComputed(({ dossier, lookups }) => ({
    status: computed(() => dossier()?.status ?? null),
    standardLookup: computed(() =>
      lookups()?.standards.find((standard) => standard.value === dossier()?.accounting_standard),
    ),
    jurisdiction: computed(() => jurisdictionOf(dossier()?.accounting_standard)),
    /** Fraction digits of the amounts: `quadrature.scale` when the dossier was generated, else the rounding mode. */
    scale: computed(() => {
      const current = dossier();
      return current?.quadrature?.scale ?? scaleOfMode(current?.rounding_to_unit_mode);
    }),
    editable: computed(() => isEditable(dossier()?.status)),
    locked: computed(() => isLocked(dossier()?.status)),
    hasStatements: computed(() => dossier()?.has_statements ?? false),
    actions: computed(() => {
      const status = dossier()?.status;
      return status === undefined ? [] : lifecycleActions(status);
    }),
    labels: computed(() => lookups()?.labels ?? {}),
  })),
  withMethods((store, api = inject(StatutoryFinancialsApiService)) => {
    const read = async (id: string, silent: boolean): Promise<void> => {
      patchState(store, { id, loading: !silent, error: null });
      try {
        const response = await firstValueFrom(api.getDossier(id));
        patchState(store, { dossier: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (action: () => Promise<SfDossier | null>): Promise<SfOutcome> => {
      patchState(store, { busy: true });
      try {
        const dossier = await action();
        patchState(store, { busy: false, ...(dossier ? { dossier } : {}) });
        return SF_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    };

    return {
      async load(id: string, locale?: SfLocale): Promise<void> {
        patchState(store, { id, dossier: null });
        const lookups = await firstValueFrom(api.getLookups(locale)).catch(() => null);
        patchState(store, { lookups: lookups?.data ?? store.lookups() });
        await read(id, false);
      },
      /** Reads the dossier again without the spinner (after a tab changed its status). */
      async refresh(): Promise<void> {
        const id = store.id();
        if (id !== null) {
          await read(id, true);
        }
      },
      /** Builds (or rebuilds) the balance sheet, income statement and cash flow from the ledger. */
      generate(): Promise<SfOutcome> {
        const id = store.id();
        return write(async () =>
          id === null ? null : (await firstValueFrom(api.generate(id))).data,
        );
      },
      generateCashFlow(method?: SfCashFlowMethod): Promise<SfOutcome> {
        const id = store.id();
        return write(async () =>
          id === null ? null : (await firstValueFrom(api.generateCashFlow(id, method))).data,
        );
      },
      async transition(target: SfTransitionTarget, reference?: string): Promise<SfOutcome> {
        const id = store.id();
        if (id === null) {
          return SF_OK;
        }
        const outcome = await write(async () => {
          await firstValueFrom(api.transitionDossier(id, target, reference));
          return (await firstValueFrom(api.getDossier(id))).data;
        });
        return outcome;
      },
    };
  }),
);
