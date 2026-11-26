import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ClosingStage,
  ClosingWorkflow,
  GeneralLedgerApiService,
  GeneralLedgerPrimaNotaApiService,
  GlFiscalYear,
  LedgerBookCode,
} from '@core';

export interface YearEndClosingState {
  fiscalYears: GlFiscalYear[];
  fiscalYearId: string | null;
  ledger: LedgerBookCode;
  workflow: ClosingWorkflow | null;
  loading: boolean;
  /** Stage being executed. */
  running: number | null;
  /** Stage the user is asked to confirm. */
  pendingStage: number | null;
  error: unknown;
}

const initialState: YearEndClosingState = {
  fiscalYears: [],
  fiscalYearId: null,
  ledger: '01',
  workflow: null,
  loading: false,
  running: null,
  pendingStage: null,
  error: null,
};

/** The four-stage year-end closing of one fiscal year and ledger book: period lock, net result, closing, opening. */
export const YearEndClosingStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    stages: computed<ClosingStage[]>(() => store.workflow()?.stages ?? []),
    completedCount: computed(
      () => (store.workflow()?.stages ?? []).filter((stage) => stage.status === 'completed').length,
    ),
    /** Index of the ready stage (0-based) for the steps component; all done points past the last. */
    currentIndex: computed(() => {
      const workflow = store.workflow();
      if (!workflow) {
        return 0;
      }
      return workflow.next_stage === null ? workflow.stages.length : workflow.next_stage - 1;
    }),
    isComplete: computed(() => store.workflow()?.is_complete ?? false),
  })),
  withMethods(
    (
      store,
      glApi = inject(GeneralLedgerApiService),
      api = inject(GeneralLedgerPrimaNotaApiService),
    ) => {
      const loadWorkflow = async (keepError = false): Promise<void> => {
        const fiscalYearId = store.fiscalYearId();
        if (!fiscalYearId) {
          patchState(store, { workflow: null });
          return;
        }
        patchState(store, keepError ? { loading: true } : { loading: true, error: null });
        try {
          const res = await firstValueFrom(api.getClosingWorkflow(fiscalYearId, store.ledger()));
          patchState(store, { workflow: res.data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, workflow: null, error });
        }
      };

      return {
        loadWorkflow,

        async loadYears(): Promise<void> {
          try {
            const res = await firstValueFrom(glApi.getFiscalYears({ per_page: 100 }));
            patchState(store, { fiscalYears: res.data ?? [] });
          } catch (error) {
            patchState(store, { error });
          }
        },

        async selectYear(fiscalYearId: string | null): Promise<void> {
          patchState(store, { fiscalYearId, workflow: null, pendingStage: null });
          await loadWorkflow();
        },

        async selectLedger(ledger: LedgerBookCode): Promise<void> {
          patchState(store, { ledger, workflow: null, pendingStage: null });
          await loadWorkflow();
        },

        /** Only the ready stage can be confirmed: the others stay blocked or already done. */
        askConfirmation(stage: number): void {
          const target = store.stages().find((candidate) => candidate.stage === stage);
          patchState(store, { pendingStage: target?.status === 'ready' ? stage : null });
        },

        cancelConfirmation(): void {
          patchState(store, { pendingStage: null });
        },

        async confirmStage(): Promise<boolean> {
          const stage = store.pendingStage();
          const fiscalYearId = store.fiscalYearId();
          if (stage === null || !fiscalYearId) {
            return false;
          }
          patchState(store, { running: stage, pendingStage: null, error: null });
          try {
            await firstValueFrom(api.runClosingStage(fiscalYearId, stage, store.ledger()));
            patchState(store, { running: null });
            await loadWorkflow();
            return true;
          } catch (error) {
            patchState(store, { running: null, error });
            await loadWorkflow(true);
            return false;
          }
        },
      };
    },
  ),
);
