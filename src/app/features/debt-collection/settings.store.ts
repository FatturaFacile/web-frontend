import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DcEnforcementOffice,
  DcEnforcementOfficePayload,
  DcInterestRate,
  DcInterestRatePayload,
  DcJurisdiction,
  DcPolicy,
  DcPolicyPayload,
  DcTemplate,
  DebtCollectionApiService,
} from '@core';
import { DC_OK, DcOutcome, failureOf } from './debt-collection.util';

export interface SettingsState {
  policies: DcPolicy[];
  rates: DcInterestRate[];
  rateJurisdiction: DcJurisdiction | null;
  templates: DcTemplate[];
  templateFilter: { code: string | null; locale: string | null };
  offices: DcEnforcementOffice[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  policies: [],
  rates: [],
  rateJurisdiction: null,
  templates: [],
  templateFilter: { code: null, locale: null },
  offices: [],
  loading: false,
  saving: false,
  error: null,
};

/** The configuration of the module: dunning policies and levels, interest rates, notice templates, enforcement offices. */
export const SettingsStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(DebtCollectionApiService)) => {
    const loadTemplates = async (): Promise<void> => {
      const { code, locale } = store.templateFilter();
      const response = await firstValueFrom(
        api.listTemplates({ ...(code ? { code } : {}), ...(locale ? { locale } : {}) }),
      );
      patchState(store, { templates: response.data });
    };

    const loadRates = async (): Promise<void> => {
      const response = await firstValueFrom(
        api.listInterestRates(store.rateJurisdiction() ?? undefined),
      );
      patchState(store, { rates: response.data });
    };

    const loadPolicies = async (): Promise<void> => {
      patchState(store, { policies: (await firstValueFrom(api.listPolicies())).data });
    };

    const loadOffices = async (): Promise<void> => {
      patchState(store, { offices: (await firstValueFrom(api.listEnforcementOffices())).data });
    };

    /** A write: runs it, then re-reads the list it changed. */
    const write = async (
      work: () => Promise<unknown>,
      reload: () => Promise<void>,
    ): Promise<DcOutcome> => {
      patchState(store, { saving: true });
      try {
        await work();
        await reload();
        patchState(store, { saving: false });
        return DC_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async load(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          await Promise.all([loadPolicies(), loadRates(), loadTemplates(), loadOffices()]);
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      },
      // Policies
      savePolicy(id: string | null, payload: DcPolicyPayload): Promise<DcOutcome> {
        return write(
          () => firstValueFrom(id ? api.updatePolicy(id, payload) : api.createPolicy(payload)),
          loadPolicies,
        );
      },
      deletePolicy(id: string): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.deletePolicy(id)), loadPolicies);
      },
      // Interest rates
      setRateJurisdiction(jurisdiction: DcJurisdiction | null): Promise<void> {
        patchState(store, { rateJurisdiction: jurisdiction });
        return loadRates();
      },
      saveRate(id: string | null, payload: DcInterestRatePayload): Promise<DcOutcome> {
        return write(
          () =>
            firstValueFrom(
              id ? api.updateInterestRate(id, payload) : api.createInterestRate(payload),
            ),
          loadRates,
        );
      },
      deleteRate(id: string): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.deleteInterestRate(id)), loadRates);
      },
      // Templates
      setTemplateFilter(patch: Partial<SettingsState['templateFilter']>): Promise<void> {
        patchState(store, { templateFilter: { ...store.templateFilter(), ...patch } });
        return loadTemplates();
      },
      saveTemplate(id: string, subject: string, body: string): Promise<DcOutcome> {
        return write(
          () => firstValueFrom(api.updateTemplate(id, { subject, body })),
          loadTemplates,
        );
      },
      // Enforcement offices
      saveOffice(id: string | null, payload: DcEnforcementOfficePayload): Promise<DcOutcome> {
        return write(
          () =>
            firstValueFrom(
              id ? api.updateEnforcementOffice(id, payload) : api.createEnforcementOffice(payload),
            ),
          loadOffices,
        );
      },
      deleteOffice(id: string): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.deleteEnforcementOffice(id)), loadOffices);
      },
    };
  }),
);
