import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  LiquidityPlanningApiService,
  LpAlert,
  LpExportFormat,
  LpGranularity,
  LpHorizonDays,
  LpLeverKey,
  LpLevers,
  LpManualItem,
  LpManualItemPayload,
  LpOverview,
  LpOverviewParams,
  LpPreset,
  LpReport,
  LpScenario,
  LpSettings,
} from '@core';
import {
  apiErrorMessage,
  exportFileName,
  hasLevers,
  sanitizeLevers,
} from './liquidity-planning.util';

export interface LiquidityPlanningState {
  overview: LpOverview | null;
  report: LpReport | null;
  presets: LpPreset[];
  scenarios: LpScenario[];
  manualItems: LpManualItem[];
  settings: LpSettings | null;
  alerts: LpAlert[];
  /** Levers being edited in the what-if panel. */
  draftLevers: LpLevers;
  /** Levers the projection on screen was computed with. */
  appliedLevers: LpLevers;
  activeScenarioId: string | null;
  horizon: LpHorizonDays;
  granularity: LpGranularity;
  showTiers: boolean;
  loading: boolean;
  saving: boolean;
  exporting: LpExportFormat | null;
  error: string | null;
}

const initialState: LiquidityPlanningState = {
  overview: null,
  report: null,
  presets: [],
  scenarios: [],
  manualItems: [],
  settings: null,
  alerts: [],
  draftLevers: {},
  appliedLevers: {},
  activeScenarioId: null,
  horizon: 180,
  granularity: 'daily',
  showTiers: false,
  loading: false,
  saving: false,
  exporting: null,
  error: null,
};

export interface LpOutcome {
  ok: boolean;
  /** Message of the failure: a translation key or the API text. */
  error: string | null;
}

export interface LpExport extends LpOutcome {
  blob: Blob | null;
  filename: string;
}

const OK: LpOutcome = { ok: true, error: null };

function failure(error: unknown): LpOutcome {
  return { ok: false, error: apiErrorMessage(error) ?? 'lp.error.generic' };
}

/** Cash flow forecast, what-if scenarios, crisis indicators, alerts and planning data of the liquidity planning workspace. */
export const LiquidityPlanningStore = signalStore(
  withState(initialState),
  withComputed(({ overview, alerts, appliedLevers, scenarios, activeScenarioId }) => ({
    currency: computed(() => overview()?.currency ?? 'EUR'),
    asOf: computed(() => overview()?.as_of ?? ''),
    baselineIndicators: computed(() => overview()?.indicators.baseline ?? null),
    scenarioIndicators: computed(() => overview()?.indicators.scenario ?? null),
    isSimulating: computed(() => hasLevers(appliedLevers())),
    activeAlerts: computed(() => alerts().filter((alert) => alert.status !== 'resolved')),
    criticalAlerts: computed(() =>
      alerts().filter((alert) => alert.status === 'open' && alert.severity === 'critical'),
    ),
    activeScenario: computed(
      () => scenarios().find((scenario) => scenario.id === activeScenarioId()) ?? null,
    ),
  })),
  withMethods((store, api = inject(LiquidityPlanningApiService)) => {
    let sequence = 0;

    const params = (): LpOverviewParams =>
      hasLevers(store.appliedLevers()) ? { levers: store.appliedLevers() } : {};

    const loadOverview = async (): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getOverview(params()));
        if (ticket === sequence) {
          patchState(store, {
            overview: response.data,
            alerts: response.data.alerts,
            loading: false,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'lp.error.load' });
        }
      }
    };

    const silently = async (task: () => Promise<void>): Promise<void> => {
      try {
        await task();
      } catch {
        // The overview reports the failure of the workspace; a side list that cannot load stays empty.
      }
    };

    const loadScenarios = (): Promise<void> =>
      silently(async () => {
        const [presets, scenarios] = await Promise.all([
          firstValueFrom(api.getPresets()),
          firstValueFrom(api.listScenarios()),
        ]);
        patchState(store, { presets: presets.data, scenarios: scenarios.data });
      });

    const loadManualItems = (): Promise<void> =>
      silently(async () => {
        patchState(store, { manualItems: (await firstValueFrom(api.listManualItems())).data });
      });

    const loadSettings = (): Promise<void> =>
      silently(async () => {
        patchState(store, { settings: (await firstValueFrom(api.getSettings())).data });
      });

    const mutate = async (task: () => Promise<void>): Promise<LpOutcome> => {
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

    const apply = async (levers: LpLevers): Promise<void> => {
      patchState(store, { appliedLevers: sanitizeLevers(levers) });
      await loadOverview();
    };

    return {
      /** Loads the whole workspace. */
      async init(): Promise<void> {
        await Promise.all([loadOverview(), loadScenarios(), loadManualItems(), loadSettings()]);
      },
      refresh: loadOverview,

      setHorizon: (horizon: LpHorizonDays): void => patchState(store, { horizon }),
      setGranularity: (granularity: LpGranularity): void => patchState(store, { granularity }),
      setShowTiers: (showTiers: boolean): void => patchState(store, { showTiers }),

      // --- What-if ---

      setLever(key: LpLeverKey, value: number | string | undefined): void {
        patchState(store, { draftLevers: { ...store.draftLevers(), [key]: value } });
      },
      /** Runs the levers of the panel against the plan. */
      applyDraft: (): Promise<void> => apply(store.draftLevers()),
      async applyPreset(code: string): Promise<void> {
        const preset = store.presets().find((candidate) => candidate.code === code);

        if (preset) {
          patchState(store, { draftLevers: { ...preset.levers }, activeScenarioId: null });
          await apply(preset.levers);
        }
      },
      async selectScenario(id: string | null): Promise<void> {
        const scenario = store.scenarios().find((candidate) => candidate.id === id);

        patchState(store, {
          activeScenarioId: scenario?.id ?? null,
          draftLevers: { ...(scenario?.levers ?? {}) },
        });
        await apply(scenario?.levers ?? {});
      },
      async resetLevers(): Promise<void> {
        patchState(store, { draftLevers: {}, activeScenarioId: null });
        await apply({});
      },
      saveScenario: (
        name: string,
        description: string | null,
        overwrite: boolean,
      ): Promise<LpOutcome> =>
        mutate(async () => {
          const payload = { name, description, levers: sanitizeLevers(store.draftLevers()) };
          const id = store.activeScenarioId();
          const saved = (
            await firstValueFrom(
              overwrite && id ? api.updateScenario(id, payload) : api.createScenario(payload),
            )
          ).data;

          patchState(store, { activeScenarioId: saved.id });
          await loadScenarios();
        }),
      deleteScenario: (id: string): Promise<LpOutcome> =>
        mutate(async () => {
          await firstValueFrom(api.deleteScenario(id));
          if (store.activeScenarioId() === id) {
            patchState(store, { activeScenarioId: null });
          }
          await loadScenarios();
        }),

      // --- Manual items and settings ---

      saveManualItem: (id: string | null, payload: LpManualItemPayload): Promise<LpOutcome> =>
        mutate(async () => {
          await firstValueFrom(
            id ? api.updateManualItem(id, payload) : api.createManualItem(payload),
          );
          await Promise.all([loadManualItems(), loadOverview()]);
        }),
      deleteManualItem: (id: string): Promise<LpOutcome> =>
        mutate(async () => {
          await firstValueFrom(api.deleteManualItem(id));
          await Promise.all([loadManualItems(), loadOverview()]);
        }),
      saveSettings: (settings: LpSettings): Promise<LpOutcome> =>
        mutate(async () => {
          patchState(store, {
            settings: (await firstValueFrom(api.updateSettings(settings))).data,
          });
          await loadOverview();
        }),

      // --- Alerts ---

      evaluateAlerts: (): Promise<LpOutcome> =>
        mutate(async () => {
          patchState(store, { alerts: (await firstValueFrom(api.evaluateAlerts())).data });
        }),
      acknowledgeAlert: (id: string): Promise<LpOutcome> =>
        mutate(async () => {
          const updated = (await firstValueFrom(api.acknowledgeAlert(id))).data;
          patchState(store, {
            alerts: store.alerts().map((alert) => (alert.id === id ? updated : alert)),
          });
        }),
      resolveAlert: (id: string): Promise<LpOutcome> =>
        mutate(async () => {
          const updated = (await firstValueFrom(api.resolveAlert(id))).data;
          patchState(store, {
            alerts: store.alerts().map((alert) => (alert.id === id ? updated : alert)),
          });
        }),

      // --- Report and export ---

      async loadReport(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          patchState(store, {
            report: (await firstValueFrom(api.getReport(params()))).data,
            loading: false,
          });
        } catch (error) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'lp.error.load' });
        }
      },
      /** Fetches the export file of the plan on screen; the screen hands the blob to the browser. */
      async download(format: LpExportFormat): Promise<LpExport> {
        const filename = exportFileName(format, store.overview()?.as_of ?? 'plan');
        patchState(store, { exporting: format });
        try {
          const blob = await firstValueFrom(api.exportReport(format, params()));
          patchState(store, { exporting: null });

          return { ...OK, blob, filename };
        } catch (error) {
          patchState(store, { exporting: null });

          return { ...failure(error), blob: null, filename };
        }
      },
    };
  }),
);
