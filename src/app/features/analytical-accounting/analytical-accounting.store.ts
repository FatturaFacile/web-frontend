import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AllocationDriver,
  AnalyticalAccountingApiService,
  AnalyticalCenterNode,
  AnalyticalCenterPayload,
  ApportionmentRun,
  ApportionmentSchedule,
  ContributionMarginReport,
  DerivationRule,
  DerivationRulePayload,
  DirectVsApportionedReport,
  ReportFilters,
  SchedulePayload,
} from '@core';
import { flattenTree, problemDetail, traceByStep } from './analytical-accounting.util';

export interface AnalyticalState {
  tree: AnalyticalCenterNode[];
  rules: DerivationRule[];
  drivers: AllocationDriver[];
  schedules: ApportionmentSchedule[];
  runs: ApportionmentRun[];
  /** The run on screen with its steps and allocation chain. */
  activeRun: ApportionmentRun | null;
  margin: ContributionMarginReport | null;
  comparison: DirectVsApportionedReport | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: AnalyticalState = {
  tree: [],
  rules: [],
  drivers: [],
  schedules: [],
  runs: [],
  activeRun: null,
  margin: null,
  comparison: null,
  loading: false,
  saving: false,
  error: null,
};

/** What a write answered: `message` carries the API reason when `ok` is false. */
export interface WriteOutcome {
  ok: boolean;
  message: string | null;
}

export const AnalyticalAccountingStore = signalStore(
  withState(initialState),
  withComputed(({ tree, rules, activeRun, schedules }) => ({
    centers: computed(() => flattenTree(tree())),
    activeCenters: computed(() => flattenTree(tree()).filter((center) => center.is_active)),
    sortedRules: computed(() => [...rules()].sort((a, b) => a.priority - b.priority)),
    activeSchedules: computed(() => schedules().filter((schedule) => schedule.is_active)),
    trace: computed(() =>
      activeRun() ? traceByStep(activeRun()?.steps ?? [], activeRun()?.allocations ?? []) : [],
    ),
    canConsolidate: computed(
      () => activeRun()?.status === 'PREVIEW' && (activeRun()?.allocations?.length ?? 0) > 0,
    ),
    canReverse: computed(() => activeRun()?.status === 'CONSOLIDATED'),
    runWarnings: computed(() => activeRun()?.warnings ?? []),
  })),
  withMethods((store, api = inject(AnalyticalAccountingApiService)) => {
    const ok: WriteOutcome = { ok: true, message: null };
    const fail = (error: unknown, fallback: string): WriteOutcome => ({
      ok: false,
      message: problemDetail(error) ?? fallback,
    });

    const loadCenters = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getCenterTree());
        patchState(store, { tree: response.data, loading: false });
      } catch (error) {
        patchState(store, {
          loading: false,
          error: problemDetail(error) ?? 'ANALYTICAL.LOAD_ERROR',
        });
      }
    };

    const loadRules = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getRules());
        patchState(store, { rules: response.data, loading: false });
      } catch (error) {
        patchState(store, {
          loading: false,
          error: problemDetail(error) ?? 'ANALYTICAL.LOAD_ERROR',
        });
      }
    };

    const loadRuns = async (): Promise<void> => {
      const response = await firstValueFrom(api.getRuns());
      patchState(store, { runs: response.data });
    };

    const write = async (
      operation: () => Promise<unknown>,
      fallback: string,
    ): Promise<WriteOutcome> => {
      patchState(store, { saving: true });
      try {
        await operation();
        patchState(store, { saving: false });
        return ok;
      } catch (error) {
        patchState(store, { saving: false });
        return fail(error, fallback);
      }
    };

    const showRun = (run: ApportionmentRun): void => {
      patchState(store, { activeRun: run });
    };

    return {
      loadCenters,
      loadRules,
      loadRuns,

      async saveCenter(id: string | null, payload: AnalyticalCenterPayload): Promise<WriteOutcome> {
        const outcome = await write(
          () => firstValueFrom(id ? api.updateCenter(id, payload) : api.createCenter(payload)),
          'ANALYTICAL.SAVE_ERROR',
        );
        if (outcome.ok) {
          await loadCenters();
        }
        return outcome;
      },

      async deactivateCenter(id: string, withDescendants: boolean): Promise<WriteOutcome> {
        const outcome = await write(
          () => firstValueFrom(api.deactivateCenter(id, withDescendants)),
          'ANALYTICAL.SAVE_ERROR',
        );
        if (outcome.ok) {
          await loadCenters();
        }
        return outcome;
      },

      async deleteCenter(id: string): Promise<WriteOutcome> {
        const outcome = await write(
          () => firstValueFrom(api.deleteCenter(id)),
          'ANALYTICAL.DELETE_CENTER_ERROR',
        );
        if (outcome.ok) {
          await loadCenters();
        }
        return outcome;
      },

      async saveRule(id: string | null, payload: DerivationRulePayload): Promise<WriteOutcome> {
        const outcome = await write(
          () => firstValueFrom(id ? api.updateRule(id, payload) : api.createRule(payload)),
          'ANALYTICAL.SAVE_ERROR',
        );
        if (outcome.ok) {
          await loadRules();
        }
        return outcome;
      },

      async deleteRule(id: string): Promise<WriteOutcome> {
        const outcome = await write(() => firstValueFrom(api.deleteRule(id)), 'ANALYTICAL.SAVE_ERROR');
        if (outcome.ok) {
          await loadRules();
        }
        return outcome;
      },

      async loadApportionment(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [schedules, drivers, runs, tree] = await Promise.all([
            firstValueFrom(api.getSchedules()),
            firstValueFrom(api.getDrivers()),
            firstValueFrom(api.getRuns()),
            firstValueFrom(api.getCenterTree()),
          ]);
          patchState(store, {
            schedules: schedules.data,
            drivers: drivers.data,
            runs: runs.data,
            tree: tree.data,
            loading: false,
          });
        } catch (error) {
          patchState(store, {
            loading: false,
            error: problemDetail(error) ?? 'ANALYTICAL.LOAD_ERROR',
          });
        }
      },

      async saveSchedule(id: string | null, payload: SchedulePayload): Promise<WriteOutcome> {
        const outcome = await write(
          () => firstValueFrom(id ? api.updateSchedule(id, payload) : api.createSchedule(payload)),
          'ANALYTICAL.SAVE_ERROR',
        );
        if (outcome.ok) {
          const schedules = await firstValueFrom(api.getSchedules());
          patchState(store, { schedules: schedules.data });
        }
        return outcome;
      },

      async saveDriverValues(
        driverId: string,
        periodKey: string,
        values: { analytical_center_id: string; value: number }[],
      ): Promise<WriteOutcome> {
        return write(
          () => firstValueFrom(api.saveDriverValues(driverId, periodKey, values)),
          'ANALYTICAL.SAVE_ERROR',
        );
      },

      /** Computes the cycle with its full trace; nothing is posted to the ledger. */
      async preview(scheduleId: string, periodKey: string): Promise<WriteOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.previewRun(scheduleId, periodKey));
          patchState(store, { saving: false });
          showRun(response.data);
          await loadRuns();
          return ok;
        } catch (error) {
          patchState(store, { saving: false });
          return fail(error, 'ANALYTICAL.PREVIEW_ERROR');
        }
      },

      async openRun(id: string): Promise<void> {
        const response = await firstValueFrom(api.getRun(id));
        showRun(response.data);
      },

      async consolidate(): Promise<WriteOutcome> {
        const run = store.activeRun();
        if (run?.status !== 'PREVIEW') {
          return { ok: false, message: 'ANALYTICAL.RUN_NOT_PREVIEW' };
        }
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.consolidateRun(run.id));
          patchState(store, { saving: false });
          showRun(response.data);
          await loadRuns();
          return ok;
        } catch (error) {
          patchState(store, { saving: false });
          return fail(error, 'ANALYTICAL.CONSOLIDATE_ERROR');
        }
      },

      async reverse(reason: string): Promise<WriteOutcome> {
        const run = store.activeRun();
        if (run?.status !== 'CONSOLIDATED') {
          return { ok: false, message: 'ANALYTICAL.RUN_NOT_CONSOLIDATED' };
        }
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.reverseRun(run.id, reason));
          patchState(store, { saving: false });
          showRun(response.data);
          await loadRuns();
          return ok;
        } catch (error) {
          patchState(store, { saving: false });
          return fail(error, 'ANALYTICAL.REVERSE_ERROR');
        }
      },

      async loadReports(filters: ReportFilters): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [margin, comparison] = await Promise.all([
            firstValueFrom(api.getContributionMargin(filters)),
            firstValueFrom(
              api.getDirectVsApportioned({
                from: filters.from,
                to: filters.to,
                center_id: filters.cost_center_id ?? filters.profit_center_id,
                include_descendants: filters.include_descendants,
              }),
            ),
          ]);
          patchState(store, { margin: margin.data, comparison: comparison.data, loading: false });
        } catch (error) {
          patchState(store, {
            loading: false,
            error: problemDetail(error) ?? 'ANALYTICAL.LOAD_ERROR',
          });
        }
      },
    };
  }),
);
