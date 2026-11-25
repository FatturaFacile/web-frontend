import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SfIndicatorsResult, SfWhatIf, StatutoryFinancialsApiService } from '@core';
import {
  cleanWhatIf,
  failureOf,
  isWhatIfEmpty,
  SF_OK,
  SfOutcome,
} from './statutory-financials.util';

export const WHAT_IF_DEBOUNCE_MS = 400;

export interface IndicatorsState {
  /** Indicators of the dossier as it stands. */
  base: SfIndicatorsResult | null;
  /** Result of the what-if the user is trying, null while nothing is changed. */
  simulated: SfIndicatorsResult | null;
  whatIf: SfWhatIf;
  loading: boolean;
  simulating: boolean;
  saving: boolean;
  error: string | null;
}

/** The financial ratios, the crisis alerts and the 6-month DSCR what-if simulator. */
export const IndicatorsStore = signalStore(
  withState<IndicatorsState>({
    base: null,
    simulated: null,
    whatIf: {},
    loading: false,
    simulating: false,
    saving: false,
    error: null,
  }),
  withComputed(({ base, simulated }) => ({
    /** What the screen shows: the simulation when there is one, else the stored indicators. */
    current: computed(() => simulated() ?? base()),
    isSimulation: computed(() => simulated() !== null),
    baseDscr: computed(() => base()?.dscr ?? null),
    simulatedDscr: computed(() => simulated()?.dscr ?? null),
  })),
  withMethods((store, api = inject(StatutoryFinancialsApiService)) => {
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cancelTimer = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const run = async (id: string): Promise<SfOutcome> => {
      const whatIf = cleanWhatIf(store.whatIf());
      if (isWhatIfEmpty(whatIf)) {
        sequence++;
        patchState(store, { simulated: null, simulating: false });
        return SF_OK;
      }
      const ticket = ++sequence;
      patchState(store, { simulating: true });
      try {
        const response = await firstValueFrom(api.simulateIndicators(id, whatIf));
        if (ticket === sequence) {
          patchState(store, { simulated: response.data, simulating: false });
        }
        return SF_OK;
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { simulating: false });
        }
        return failureOf(error);
      }
    };

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const response = await firstValueFrom(api.getIndicators(id));
          patchState(store, { base: response.data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      /** Changes parameters of the what-if and simulates after a pause, so dragging a slider is one call. */
      setWhatIf(id: string, patch: SfWhatIf, debounceMs: number = WHAT_IF_DEBOUNCE_MS): void {
        patchState(store, { whatIf: { ...store.whatIf(), ...patch } });
        cancelTimer();
        timer = setTimeout(() => {
          timer = null;
          void run(id);
        }, debounceMs);
      },
      simulateNow(id: string): Promise<SfOutcome> {
        cancelTimer();
        return run(id);
      },
      /** Clears the what-if and goes back to the stored indicators. */
      reset(): void {
        cancelTimer();
        sequence++;
        patchState(store, { whatIf: {}, simulated: null, simulating: false });
      },
      /** Persists the indicators (with the what-if in use) on the deposit package. */
      async saveToPackage(id: string): Promise<SfOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(
            api.saveIndicators(id, cleanWhatIf(store.whatIf())),
          );
          patchState(store, { saving: false, base: response.data });
          return SF_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      dispose(): void {
        cancelTimer();
      },
    };
  }),
);
