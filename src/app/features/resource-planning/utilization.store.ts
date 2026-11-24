import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CapacityResource,
  ResourcePlanningApiService,
  UtilizationGroupBy,
  UtilizationReport,
  UtilizationTarget,
  UtilizationTargetPayload,
} from '@core';
import { problemDetail } from './resource-planning.util';

export interface UtilizationState {
  from: string;
  to: string;
  groupBy: UtilizationGroupBy;
  report: UtilizationReport | null;
  targets: UtilizationTarget[];
  resources: CapacityResource[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

function monthBounds(today: Date): { from: string; to: string } {
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const initialState: UtilizationState = {
  ...monthBounds(new Date()),
  groupBy: 'resource',
  report: null,
  targets: [],
  resources: [],
  loading: false,
  saving: false,
  error: null,
};

export const UtilizationStore = signalStore(
  withState(initialState),
  withComputed(({ report, resources, targets }) => ({
    rows: computed(() => report()?.rows ?? []),
    totals: computed(() => report()?.totals ?? null),
    defaultTarget: computed(() => report()?.default_target_percent ?? null),
    departments: computed(() => {
      const found = new Map<string, string>();
      for (const resource of resources()) {
        if (resource.department_id && resource.department_name) {
          found.set(resource.department_id, resource.department_name);
        }
      }
      return [...found].map(([id, name]) => ({ id, name }));
    }),
    costCenters: computed(() => {
      const found = new Map<string, string>();
      for (const resource of resources()) {
        if (resource.cost_center_id && resource.cost_center_name) {
          found.set(resource.cost_center_id, resource.cost_center_name);
        }
      }
      return [...found].map(([id, name]) => ({ id, name }));
    }),
    /** Rows that miss their target by more than the tolerance: the ones a planner has to act on first. */
    belowTarget: computed(() => (report()?.rows ?? []).filter((row) => row.status === 'below_target')),
    tenantTarget: computed(
      () =>
        targets().find((target) => target.department_id === null && target.cost_center_id === null) ??
        null,
    ),
  })),
  withMethods((store, api = inject(ResourcePlanningApiService)) => {
    let sequence = 0;

    const load = async (): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const [report, targets] = await Promise.all([
          firstValueFrom(api.getUtilizationReport(store.from(), store.to(), store.groupBy())),
          firstValueFrom(api.getUtilizationTargets()),
        ]);
        if (ticket === sequence) {
          patchState(store, { report: report.data, targets: targets.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, {
            loading: false,
            error: problemDetail(error) ?? 'resourcePlanning.loadError',
          });
        }
      }
    };

    return {
      async init(): Promise<void> {
        const resources = await firstValueFrom(api.getResources()).catch(() => null);
        patchState(store, { resources: resources?.data ?? [] });
        await load();
      },
      load,
      async setGroupBy(groupBy: UtilizationGroupBy): Promise<void> {
        patchState(store, { groupBy });
        await load();
      },
      async setRange(from: string, to: string): Promise<void> {
        patchState(store, { from, to });
        await load();
      },
      /** Upserts a target (both ids null is the tenant default) and refreshes the report. */
      async saveTarget(payload: UtilizationTargetPayload): Promise<boolean> {
        patchState(store, { saving: true, error: null });
        try {
          await firstValueFrom(api.saveUtilizationTarget(payload));
          patchState(store, { saving: false });
          await load();
          return true;
        } catch (error) {
          patchState(store, {
            saving: false,
            error: problemDetail(error) ?? 'resourcePlanning.saveError',
          });
          return false;
        }
      },
    };
  }),
);
