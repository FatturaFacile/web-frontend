import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  SfDossier,
  SfDossierPayload,
  SfDossierSummary,
  SfEligibility,
  SfLocale,
  SfLookups,
  StatutoryFinancialsApiService,
} from '@core';
import { failureOf, SF_OK, SfOutcome } from './statutory-financials.util';

export interface WizardState {
  lookups: SfLookups | null;
  /** The dossier being edited (loaded) or the one just created at the end of step 2. */
  dossier: SfDossierSummary | null;
  /** The detail of an existing dossier, to prefill the form. */
  existing: SfDossier | null;
  eligibility: SfEligibility | null;
  loading: boolean;
  saving: boolean;
  checking: boolean;
  error: string | null;
}

/** The creation and configuration wizard of a dossier (also the settings form of an editable one). */
export const WizardStore = signalStore(
  withState<WizardState>({
    lookups: null,
    dossier: null,
    existing: null,
    eligibility: null,
    loading: false,
    saving: false,
    checking: false,
    error: null,
  }),
  withComputed(({ lookups }) => ({
    fiscalYears: computed(() => lookups()?.fiscal_years ?? []),
    standards: computed(() => lookups()?.standards ?? []),
    roundingModes: computed(() => lookups()?.rounding_modes ?? []),
  })),
  withMethods((store, api = inject(StatutoryFinancialsApiService)) => ({
    /** Loads the lookups and, when editing, the dossier. */
    async init(id: string | null, locale?: SfLocale): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const lookups = await firstValueFrom(api.getLookups(locale));
        patchState(store, { lookups: lookups.data });
        if (id !== null) {
          const dossier = await firstValueFrom(api.getDossier(id));
          patchState(store, { existing: dossier.data, dossier: dossier.data });
        }
        patchState(store, { loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    /** Creates the dossier (no dossier yet) or updates the one the wizard holds. */
    async save(payload: SfDossierPayload): Promise<SfOutcome> {
      patchState(store, { saving: true });
      try {
        const current = store.dossier();
        const response = current
          ? await firstValueFrom(api.updateDossier(current.id, payload))
          : await firstValueFrom(api.createDossier(payload));
        patchState(store, { saving: false, dossier: response.data });
        return SF_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    },
    /** The dimensional threshold check of the dossier, for the standard it holds or a chosen one. */
    async checkEligibility(standard?: SfDossierSummary['accounting_standard']): Promise<SfOutcome> {
      const current = store.dossier();
      if (current === null) {
        return SF_OK;
      }
      patchState(store, { checking: true });
      try {
        const response = await firstValueFrom(api.getEligibility(current.id, standard));
        patchState(store, { checking: false, eligibility: response.data });
        return SF_OK;
      } catch (error) {
        patchState(store, { checking: false });
        return failureOf(error);
      }
    },
    /** Moves the dossier to the standard the check recommends, then checks it again. */
    async switchToRecommended(): Promise<SfOutcome> {
      const current = store.dossier();
      const recommended = store.eligibility()?.recommended_standard;
      if (current === null || recommended === undefined) {
        return SF_OK;
      }
      patchState(store, { saving: true });
      try {
        const response = await firstValueFrom(
          api.updateDossier(current.id, { accounting_standard: recommended }),
        );
        patchState(store, { saving: false, dossier: response.data });
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
      try {
        const check = await firstValueFrom(api.getEligibility(current.id, recommended));
        patchState(store, { eligibility: check.data });
        return SF_OK;
      } catch (error) {
        return failureOf(error);
      }
    },
  })),
);
