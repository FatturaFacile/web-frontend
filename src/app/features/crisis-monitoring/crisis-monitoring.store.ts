import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CrisisApproach,
  CrisisBasis,
  CrisisDashboard,
  CrisisHorizon,
  CrisisJurisdiction,
  CrisisLoan,
  CrisisLoanPayload,
  CrisisLocale,
  CrisisMetadata,
  CrisisMonitoringApiService,
  CrisisProfile,
  CrisisRangruecktritt,
  CrisisStressInput,
  CrisisStressResult,
} from '@core';
import {
  agreementFileName,
  apiErrorMessage,
  DEFAULT_DSCR_BANDS,
  dossierFileName,
  EMPTY_STRESS,
  isStressed,
  pickDscr,
  profileDiff,
  sanitizeStress,
  STRESS_DEBOUNCE_MS,
} from './crisis-monitoring.util';

export interface CrisisMonitoringState {
  dashboard: CrisisDashboard | null;
  profile: CrisisProfile | null;
  metadata: CrisisMetadata | null;
  loans: CrisisLoan[];
  requirement: CrisisRangruecktritt | null;
  /** Jurisdiction the user is inspecting; null follows the one the API reports. */
  jurisdictionView: CrisisJurisdiction | null;
  horizon: CrisisHorizon;
  approach: CrisisApproach;
  stressInput: CrisisStressInput;
  stressResult: CrisisStressResult | null;
  stressRunning: boolean;
  stressError: string | null;
  requirementLoading: boolean;
  loading: boolean;
  saving: boolean;
  computing: boolean;
  downloading: boolean;
  error: string | null;
}

const initialState: CrisisMonitoringState = {
  dashboard: null,
  profile: null,
  metadata: null,
  loans: [],
  requirement: null,
  jurisdictionView: null,
  horizon: 'm6',
  approach: 'treasury',
  stressInput: { ...EMPTY_STRESS },
  stressResult: null,
  stressRunning: false,
  stressError: null,
  requirementLoading: false,
  loading: false,
  saving: false,
  computing: false,
  downloading: false,
  error: null,
};

export interface CrisisOutcome {
  ok: boolean;
  /** Message of the failure: a translation key or the API text. */
  error: string | null;
}

export interface CrisisDownload extends CrisisOutcome {
  blob: Blob | null;
  filename: string;
}

const OK: CrisisOutcome = { ok: true, error: null };

function failure(error: unknown): CrisisOutcome {
  return { ok: false, error: apiErrorMessage(error) ?? 'crisis.error.generic' };
}

/** Executive dashboard, CCII and Swiss guardrails, Rangruecktritt loans, stress test and profile of the crisis monitor. */
export const CrisisMonitoringStore = signalStore(
  withState(initialState),
  withComputed(({ dashboard, jurisdictionView, metadata, horizon, approach, loans }) => ({
    currency: computed(() => dashboard()?.currency ?? 'EUR'),
    asOf: computed(() => dashboard()?.as_of ?? ''),
    /** Jurisdiction on screen: the user's pick, else the one of the API. */
    view: computed<CrisisJurisdiction>(
      () => jurisdictionView() ?? dashboard()?.jurisdiction ?? 'IT',
    ),
    bands: computed(() => metadata()?.dscr_bands ?? DEFAULT_DSCR_BANDS),
    selectedDscr: computed(() => pickDscr(dashboard()?.dscr, approach(), horizon())),
    timeline: computed(() => dashboard()?.timeline ?? []),
    activeLoans: computed(() => loans().filter((loan) => loan.status === 'active')),
  })),
  withMethods((store, api = inject(CrisisMonitoringApiService)) => {
    let sequence = 0;
    let stressSequence = 0;
    let stressTimer: ReturnType<typeof setTimeout> | null = null;

    const silently = async (task: () => Promise<void>): Promise<void> => {
      try {
        await task();
      } catch {
        // The dashboard reports the failure of the workspace; a side list that cannot load stays empty.
      }
    };

    const loadDashboard = async (): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getDashboard());
        if (ticket === sequence) {
          patchState(store, { dashboard: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, {
            loading: false,
            error: apiErrorMessage(error) ?? 'crisis.error.load',
          });
        }
      }
    };

    const loadMetadata = (): Promise<void> =>
      silently(async () => {
        patchState(store, { metadata: (await firstValueFrom(api.getMetadata())).data });
      });

    const loadProfile = (): Promise<void> =>
      silently(async () => {
        patchState(store, { profile: (await firstValueFrom(api.getProfile())).data });
      });

    const loadLoans = (): Promise<void> =>
      silently(async () => {
        patchState(store, { loans: (await firstValueFrom(api.listLoans())).data });
      });

    const mutate = async (task: () => Promise<void>): Promise<CrisisOutcome> => {
      patchState(store, { saving: true });
      try {
        await task();
        patchState(store, { saving: false });

        return OK;
      } catch (error) {
        patchState(store, { saving: false });

        return failure(error);
      }
    };

    const fetchBlob = async (
      request: () => Promise<Blob>,
      filename: string,
    ): Promise<CrisisDownload> => {
      patchState(store, { downloading: true });
      try {
        const blob = await request();
        patchState(store, { downloading: false });

        return { ...OK, blob, filename };
      } catch (error) {
        patchState(store, { downloading: false });

        return { ...failure(error), blob: null, filename };
      }
    };

    const runStress = async (input: CrisisStressInput): Promise<void> => {
      const ticket = ++stressSequence;

      if (!isStressed(input)) {
        patchState(store, { stressResult: null, stressRunning: false, stressError: null });

        return;
      }
      patchState(store, { stressRunning: true, stressError: null });
      try {
        const response = await firstValueFrom(api.stressTest(input));
        if (ticket === stressSequence) {
          patchState(store, { stressResult: response.data, stressRunning: false });
        }
      } catch (error) {
        if (ticket === stressSequence) {
          patchState(store, {
            stressRunning: false,
            stressError: apiErrorMessage(error) ?? 'crisis.error.stress',
          });
        }
      }
    };

    return {
      /** Loads the whole workspace. */
      async init(): Promise<void> {
        await Promise.all([loadDashboard(), loadMetadata(), loadProfile(), loadLoans()]);
      },
      refresh: loadDashboard,
      /** Recomputes the indicators on the server (persisting the snapshots) and shows the result. */
      async compute(): Promise<CrisisOutcome> {
        patchState(store, { computing: true, error: null });
        try {
          const response = await firstValueFrom(api.compute());
          patchState(store, { dashboard: response.data, computing: false });

          return OK;
        } catch (error) {
          patchState(store, { computing: false });

          return failure(error);
        }
      },

      setJurisdictionView: (jurisdictionView: CrisisJurisdiction): void =>
        patchState(store, { jurisdictionView }),
      setHorizon: (horizon: CrisisHorizon): void => patchState(store, { horizon }),
      setApproach: (approach: CrisisApproach): void => patchState(store, { approach }),

      // --- Dossier ---

      downloadDossier: (locale: CrisisLocale): Promise<CrisisDownload> =>
        fetchBlob(
          () => firstValueFrom(api.downloadDossier(locale)),
          dossierFileName(store.dashboard()?.as_of ?? 'board', locale),
        ),

      // --- Profile ---

      saveProfile: (draft: CrisisProfile): Promise<CrisisOutcome> =>
        mutate(async () => {
          const original = store.profile();
          const payload = original === null ? draft : profileDiff(original, draft);
          patchState(store, { profile: (await firstValueFrom(api.updateProfile(payload))).data });
          await loadDashboard();
        }),

      // --- Subordinated loans ---

      saveLoan: (id: string | null, payload: CrisisLoanPayload): Promise<CrisisOutcome> =>
        mutate(async () => {
          await firstValueFrom(id ? api.updateLoan(id, payload) : api.createLoan(payload));
          await Promise.all([loadLoans(), loadDashboard()]);
        }),
      deleteLoan: (id: string): Promise<CrisisOutcome> =>
        mutate(async () => {
          await firstValueFrom(api.deleteLoan(id));
          await Promise.all([loadLoans(), loadDashboard()]);
        }),
      downloadAgreement: (loan: CrisisLoan, locale: CrisisLocale): Promise<CrisisDownload> =>
        fetchBlob(
          () => firstValueFrom(api.downloadAgreement(loan.id, locale)),
          agreementFileName(loan.creditor_name, locale),
        ),

      /** Required Rangruecktritt for the horizon, rate and basis of the calculator. */
      async calculateRequirement(
        horizonMonths: number,
        interestRate: string | null,
        basis: CrisisBasis,
      ): Promise<CrisisOutcome> {
        patchState(store, { requirementLoading: true });
        try {
          const response = await firstValueFrom(
            api.getRequirement({
              horizon_months: horizonMonths,
              interest_rate: interestRate,
              basis,
            }),
          );
          patchState(store, { requirement: response.data, requirementLoading: false });

          return OK;
        } catch (error) {
          patchState(store, { requirementLoading: false });

          return failure(error);
        }
      },

      // --- Stress test ---

      /** Sets the levers and runs the simulation once the user stops moving them. */
      setStress(input: Partial<CrisisStressInput>): void {
        const next = sanitizeStress({ ...store.stressInput(), ...input });
        patchState(store, { stressInput: next });

        if (stressTimer !== null) {
          clearTimeout(stressTimer);
        }
        stressTimer = setTimeout(() => {
          stressTimer = null;
          void runStress(next);
        }, STRESS_DEBOUNCE_MS);
      },
      resetStress(): void {
        if (stressTimer !== null) {
          clearTimeout(stressTimer);
          stressTimer = null;
        }
        stressSequence++;
        patchState(store, {
          stressInput: { ...EMPTY_STRESS },
          stressResult: null,
          stressRunning: false,
          stressError: null,
        });
      },
      /** Runs the simulation immediately (without waiting for the debounce). */
      runStressNow: (): Promise<void> => runStress(store.stressInput()),
    };
  }),
);
