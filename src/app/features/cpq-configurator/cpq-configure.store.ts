import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CpqConfiguratorApiService,
  CpqEvaluation,
  CpqEvaluationRequest,
  CpqInstance,
  CpqModelRecord,
  CpqProposal,
  CpqSelectionValue,
} from '@core';
import { characteristicsOfStep, CpqFailure, failureOf } from './cpq-format';

/** Pause after the last change before the selection is evaluated again, so typing a number is one call, not many. */
export const CPQ_EVALUATION_DELAY_MS = 200;

export interface CpqConfigureState {
  models: CpqModelRecord[];
  loadingModels: boolean;
  modelId: string | null;
  /** The answers of the sales representative only; automatic inclusions and defaults come back from the API. */
  selections: Record<string, CpqSelectionValue>;
  quantity: number;
  discountPercent: number;
  customerReference: string;
  evaluation: CpqEvaluation | null;
  evaluating: boolean;
  activeStep: number;
  confirming: boolean;
  instance: CpqInstance | null;
  /** True when the confirmation found an identical configuration and reused its part number. */
  reused: boolean;
  proposal: CpqProposal | null;
  loadingProposal: boolean;
  failure: CpqFailure | null;
}

const initialState: CpqConfigureState = {
  models: [],
  loadingModels: false,
  modelId: null,
  selections: {},
  quantity: 1,
  discountPercent: 0,
  customerReference: '',
  evaluation: null,
  evaluating: false,
  activeStep: 0,
  confirming: false,
  instance: null,
  reused: false,
  proposal: null,
  loadingProposal: false,
  failure: null,
};

/**
 * State of the guided configurator: the models to choose from, the answers, the live evaluation (constraints, super-BOM,
 * routing, cost, price, margin, lead time, preview layers), the confirmation and the proposal. Every change of an answer
 * schedules one evaluation; an answer that arrives after a newer request is discarded.
 */
export const CpqConfigureStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    model: computed(
      () => store.models().find((candidate) => candidate.id === store.modelId()) ?? null,
    ),
    steps: computed(() => store.evaluation()?.steps ?? []),
    currentStep: computed(() => store.evaluation()?.steps[store.activeStep()] ?? null),
    stepCharacteristics: computed(() => {
      const evaluation = store.evaluation();
      const step = evaluation?.steps[store.activeStep()];

      return evaluation && step
        ? characteristicsOfStep(evaluation, step.code).filter(
            (characteristic) => characteristic.visible,
          )
        : [];
    }),
    errors: computed(() =>
      (store.evaluation()?.violations ?? []).filter((violation) => violation.severity === 'error'),
    ),
    notices: computed(() =>
      (store.evaluation()?.violations ?? []).filter((violation) => violation.severity !== 'error'),
    ),
    canConfirm: computed(() => {
      const evaluation = store.evaluation();

      return (
        !!evaluation &&
        evaluation.valid &&
        evaluation.complete &&
        !store.evaluating() &&
        !store.confirming()
      );
    }),
    request: computed((): CpqEvaluationRequest => ({
      selections: store.selections(),
      quantity: store.quantity(),
      discount_percent: store.discountPercent(),
      customer_reference: store.customerReference() || null,
    })),
  })),
  withMethods((store, api = inject(CpqConfiguratorApiService)) => {
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const evaluateNow = async (): Promise<void> => {
      const modelId = store.modelId();
      if (!modelId) {
        return;
      }
      const ticket = ++sequence;
      patchState(store, { evaluating: true, failure: null });
      try {
        const response = await firstValueFrom(api.evaluate(modelId, store.request()));
        if (ticket === sequence) {
          const steps = response.data.steps.length;
          patchState(store, {
            evaluation: response.data,
            evaluating: false,
            activeStep: Math.min(store.activeStep(), Math.max(steps - 1, 0)),
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { evaluating: false, failure: failureOf(error) });
        }
      }
    };

    const schedule = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      patchState(store, { instance: null, reused: false, proposal: null });
      timer = setTimeout(() => {
        timer = null;
        void evaluateNow();
      }, CPQ_EVALUATION_DELAY_MS);
    };

    return {
      evaluateNow,
      async loadModels(): Promise<void> {
        patchState(store, { loadingModels: true, failure: null });
        try {
          const response = await firstValueFrom(api.getModels('published'));
          patchState(store, { models: response.data, loadingModels: false });
        } catch (error) {
          patchState(store, { loadingModels: false, failure: failureOf(error) });
        }
      },
      /** Starts a configuration of a model: no answers, the defaults and the first evaluation come from the API. */
      async selectModel(modelId: string): Promise<void> {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        patchState(store, { ...initialState, models: store.models(), modelId });
        await evaluateNow();
      },
      setValue(code: string, value: CpqSelectionValue): void {
        patchState(store, { selections: { ...store.selections(), [code]: value } });
        schedule();
      },
      /** Takes an answer back, so the characteristic goes to its default again. */
      clearValue(code: string): void {
        const rest = { ...store.selections() };
        delete rest[code];
        patchState(store, { selections: rest });
        schedule();
      },
      setQuantity(quantity: number | null): void {
        patchState(store, { quantity: quantity && quantity > 0 ? quantity : 1 });
        schedule();
      },
      setDiscount(percent: number | null): void {
        patchState(store, { discountPercent: percent && percent > 0 ? percent : 0 });
        schedule();
      },
      setCustomerReference(reference: string): void {
        patchState(store, { customerReference: reference, instance: null, reused: false });
      },
      setStep(index: number): void {
        patchState(store, {
          activeStep: Math.max(0, Math.min(index, Math.max(store.steps().length - 1, 0))),
        });
      },
      /** Confirms the configuration: an identical one answers with its part number, a new one gets a new part number. */
      async confirm(): Promise<boolean> {
        const modelId = store.modelId();
        if (!modelId || !store.canConfirm()) {
          return false;
        }
        patchState(store, { confirming: true, failure: null });
        try {
          const response = await firstValueFrom(api.confirm(modelId, store.request()));
          patchState(store, {
            confirming: false,
            instance: response.data,
            reused: response.meta?.reused === true,
          });
          return true;
        } catch (error) {
          patchState(store, { confirming: false, failure: failureOf(error) });
          return false;
        }
      },
      /** The proposal of the current selection; the industrial breakdown is asked for only when the caller may show it. */
      async loadProposal(includeBreakdown: boolean): Promise<boolean> {
        const modelId = store.modelId();
        if (!modelId) {
          return false;
        }
        patchState(store, { loadingProposal: true, failure: null });
        try {
          const response = await firstValueFrom(
            api.previewProposal(modelId, {
              ...store.request(),
              include_breakdown: includeBreakdown,
            }),
          );
          patchState(store, { proposal: response.data, loadingProposal: false });
          return true;
        } catch (error) {
          patchState(store, { loadingProposal: false, failure: failureOf(error) });
          return false;
        }
      },
      closeProposal(): void {
        patchState(store, { proposal: null });
      },
      async downloadProposalPdf(): Promise<Blob | null> {
        const instance = store.instance();
        if (!instance) {
          return null;
        }
        try {
          return await firstValueFrom(
            api.downloadInstanceProposalPdf(instance.id, {
              quantity: store.quantity(),
              discount_percent: store.discountPercent(),
            }),
          );
        } catch (error) {
          patchState(store, { failure: failureOf(error) });
          return null;
        }
      },
      reset(): void {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        sequence++;
        patchState(store, { ...initialState, models: store.models() });
      },
    };
  }),
);
