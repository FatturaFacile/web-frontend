import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { WithholdingRecipientsApiService, WrLookups, WrRecipient, WrSimulation } from '@core';
import {
  defaultSimulatorForm,
  failureOf,
  isSimulatorFormReady,
  SimulatorFormValue,
  simulatePayloadOf,
} from './withholding-recipients.util';

/** Pause after the last keystroke before the simulation runs. */
export const SIMULATION_DEBOUNCE_MS = 350;

export interface SimulatorState {
  form: SimulatorFormValue;
  result: WrSimulation | null;
  recipients: WrRecipient[];
  lookups: WrLookups | null;
  loading: boolean;
  error: string | null;
  /** The text the API sent for the refusal (validation message), shown next to the translated error. */
  detail: string | null;
}

const initialState = (): SimulatorState => ({
  form: defaultSimulatorForm(),
  result: null,
  recipients: [],
  lookups: null,
  loading: false,
  error: null,
  detail: null,
});

/** The fee-note and compensation simulator: every change of the form re-runs the calculation after a short pause. */
export const SimulatorStore = signalStore(
  withState(initialState()),
  withComputed(({ form, recipients }) => ({
    ready: computed(() => isSimulatorFormReady(form())),
    recipient: computed(
      () => recipients().find((entry) => entry.id === form().recipient_profile_id) ?? null,
    ),
    /** The regime the calculation runs for: the one of the registered recipient, or the one picked for ad-hoc facts. */
    regime: computed(() => {
      const picked = recipients().find((entry) => entry.id === form().recipient_profile_id);
      return picked ? picked.regime : form().regime;
    }),
  })),
  withMethods((store, api = inject(WithholdingRecipientsApiService)) => {
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cancelTimer = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const simulate = async (): Promise<void> => {
      cancelTimer();
      const ticket = ++sequence;
      if (!isSimulatorFormReady(store.form())) {
        patchState(store, { result: null, loading: false, error: null, detail: null });
        return;
      }
      patchState(store, { loading: true, error: null, detail: null });
      try {
        const response = await firstValueFrom(api.simulate(simulatePayloadOf(store.form())));
        if (ticket === sequence) {
          patchState(store, { result: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          const outcome = await failureOf(error);
          patchState(store, {
            result: null,
            loading: false,
            error: outcome.errorKey,
            detail: outcome.detail,
          });
        }
      }
    };

    const schedule = (): void => {
      cancelTimer();
      timer = setTimeout(() => {
        timer = null;
        void simulate();
      }, SIMULATION_DEBOUNCE_MS);
    };

    return {
      simulate,
      async init(): Promise<void> {
        const [lookups, recipients] = await Promise.allSettled([
          firstValueFrom(api.getLookups()),
          firstValueFrom(api.listRecipients()),
        ]);
        if (lookups.status === 'fulfilled') {
          patchState(store, { lookups: lookups.value.data });
        } else {
          patchState(store, { error: (await failureOf(lookups.reason)).errorKey });
        }
        if (recipients.status === 'fulfilled') {
          patchState(store, {
            recipients: recipients.value.data.filter((entry) => entry.is_active),
          });
        }
      },
      /** Changes the form and schedules the simulation (it runs once the user stops typing). */
      patch(change: Partial<SimulatorFormValue>): void {
        patchState(store, { form: { ...store.form(), ...change } });
        schedule();
      },
      /** Picks a registered recipient (its profile feeds the calculation) or goes back to ad-hoc facts with null. */
      pickRecipient(id: string | null): void {
        const picked = store.recipients().find((entry) => entry.id === id);
        patchState(store, {
          form: {
            ...store.form(),
            recipient_profile_id: id,
            ...(picked ? { regime: picked.regime } : {}),
          },
        });
        schedule();
      },
      reset(): void {
        cancelTimer();
        sequence++;
        patchState(store, {
          form: defaultSimulatorForm(),
          result: null,
          loading: false,
          error: null,
          detail: null,
        });
      },
      /** Stops a pending simulation (the page is leaving). */
      dispose(): void {
        cancelTimer();
        sequence++;
      },
    };
  }),
);
