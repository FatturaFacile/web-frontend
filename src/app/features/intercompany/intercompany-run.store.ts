import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ConsolidationRun,
  GeneralLedgerConsolidationApiService,
  IcEliminationLedger,
  IcNciSchedule,
  IcRunStatus,
  IcRunWorkflow,
  IcScopeValidation,
  IntercompanyApiService,
} from '@core';
import { attempt, IcOutcome, isClosedRun, stepIndexOf } from './intercompany.util';

export interface IntercompanyRunState {
  workflow: IcRunWorkflow | null;
  scope: IcScopeValidation | null;
  ledger: IcEliminationLedger | null;
  nci: IcNciSchedule | null;
  ledgerType: string;
  /** The step the wizard shows; it follows the workflow status unless the user goes back to read an earlier one. */
  step: number;
  loading: boolean;
  busy: boolean;
  error: string | null;
}

const initialState: IntercompanyRunState = {
  workflow: null,
  scope: null,
  ledger: null,
  nci: null,
  ledgerType: '',
  step: 0,
  loading: false,
  busy: false,
  error: null,
};

/** The guided consolidation run: scope validation, translation and NCI, the elimination ledger, review, lock and reopen. */
export const IntercompanyRunStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    status: computed<IcRunStatus | null>(() => store.workflow()?.status ?? null),
    closed: computed(() => isClosedRun(store.workflow()?.status ?? null)),
    history: computed(() => store.workflow()?.history ?? []),
    canAdvanceTo: computed(
      () =>
        (to: string): boolean =>
          store.workflow()?.allowed_transitions.includes(to) ?? false,
    ),
    failedChecks: computed(() => (store.scope()?.checks ?? []).filter((check) => !check.passed)),
  })),
  withMethods(
    (
      store,
      api = inject(IntercompanyApiService),
      consolidation = inject(GeneralLedgerConsolidationApiService),
    ) => {
      const applyWorkflow = (workflow: IcRunWorkflow): void => patchState(store, { workflow });

      const move = async (call: () => Promise<IcRunWorkflow>): Promise<IcOutcome> => {
        patchState(store, { busy: true, error: null });
        const { outcome, value } = await attempt(call);
        patchState(store, { busy: false, error: outcome.errorKey });
        if (value !== null) {
          applyWorkflow(value);
          patchState(store, { step: stepIndexOf(value.status) });
        }
        return outcome;
      };

      return {
        async load(runId: string): Promise<void> {
          patchState(store, { ...initialState, loading: true });
          const { outcome, value } = await attempt(async () => {
            const [workflow, scope, ledger, nci] = await Promise.all([
              firstValueFrom(api.getWorkflow(runId)),
              firstValueFrom(api.getScopeValidation(runId)),
              firstValueFrom(api.getEliminationLedger(runId)),
              firstValueFrom(api.getNciSchedule(runId)),
            ]);
            return {
              workflow: workflow.data,
              scope: scope.data,
              ledger: ledger.data,
              nci: nci.data,
            };
          });
          patchState(store, value ?? {}, { loading: false, error: outcome.errorKey });
          if (value !== null) {
            patchState(store, { step: stepIndexOf(value.workflow.status) });
          }
        },
        goTo(step: number): void {
          patchState(store, { step });
        },
        async filterLedger(runId: string, type: string): Promise<void> {
          patchState(store, { ledgerType: type });
          const { value } = await attempt(() =>
            firstValueFrom(api.getEliminationLedger(runId, { type })),
          );
          if (value !== null) {
            patchState(store, { ledger: value.data });
          }
        },
        async revalidateScope(runId: string): Promise<void> {
          const { value } = await attempt(() => firstValueFrom(api.getScopeValidation(runId)));
          if (value !== null) {
            patchState(store, { scope: value.data });
          }
        },
        /** Moves the run to the next status; the version the screen holds guards against a stale view (409). */
        advance(runId: string, to: Exclude<IcRunStatus, 'draft'>): Promise<IcOutcome> {
          const version = store.workflow()?.version ?? 0;
          return move(async () => (await firstValueFrom(api.advanceRun(runId, to, version))).data);
        },
        reopen(runId: string, reason: string): Promise<IcOutcome> {
          const version = store.workflow()?.version ?? 0;
          return move(
            async () => (await firstValueFrom(api.reopenRun(runId, reason, version))).data,
          );
        },
        /** Starts a new consolidation run of the group for a fiscal period (the calculation of the existing engine). */
        async startRun(
          groupId: string,
          fiscalPeriodId: string,
        ): Promise<IcOutcome & { run: ConsolidationRun | null }> {
          patchState(store, { busy: true, error: null });
          const { outcome, value } = await attempt(() =>
            firstValueFrom(consolidation.runConsolidation(groupId, fiscalPeriodId)),
          );
          patchState(store, { busy: false, error: outcome.errorKey });
          return { ...outcome, run: value?.data ?? null };
        },
      };
    },
  ),
);
