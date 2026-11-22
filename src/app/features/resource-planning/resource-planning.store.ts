import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AllocationMutationResult,
  AllocationPayload,
  CapacityHeatmap,
  CapacityResource,
  ConvertToHardPayload,
  HeatmapGranularity,
  PlanningIssue,
  RebalancePayload,
  ResourceAllocation,
  ResourcePlanningApiService,
} from '@core';
import {
  AllocationBar,
  moveAnchor,
  overloadedRows,
  problemDetail,
  problemIssues,
  stackBars,
  windowOf,
} from './resource-planning.util';

export interface PlannerState {
  granularity: HeatmapGranularity;
  /** Any date inside the first period on screen. */
  anchor: string;
  departmentId: string | null;
  heatmap: CapacityHeatmap | null;
  allocations: ResourceAllocation[];
  resources: CapacityResource[];
  loading: boolean;
  saving: boolean;
  /** Translation key or server text of a failed load or of a failure without findings. */
  error: string | null;
  /** The overload verdict and soft warnings of the last change. */
  lastResult: AllocationMutationResult | null;
  /** The rules the last refused change violated. */
  lastIssues: PlanningIssue[];
  /** The booking whose change was refused: its bar is highlighted. */
  rejectedAllocationId: string | null;
}

/** What a change answered: `ok` is false when the API refused it, the rules are then in `issues`. */
export interface PlannerOutcome {
  ok: boolean;
  result: AllocationMutationResult | null;
  issues: PlanningIssue[];
  message: string | null;
}

const initialState: PlannerState = {
  granularity: 'week',
  anchor: new Date().toISOString().slice(0, 10),
  departmentId: null,
  heatmap: null,
  allocations: [],
  resources: [],
  loading: false,
  saving: false,
  error: null,
  lastResult: null,
  lastIssues: [],
  rejectedAllocationId: null,
};

export const ResourcePlannerStore = signalStore(
  withState(initialState),
  withComputed(({ heatmap, allocations, granularity, anchor, resources }) => ({
    window: computed(() => windowOf(anchor(), granularity())),
    periods: computed(() => heatmap()?.periods ?? []),
    rows: computed(() => heatmap()?.rows ?? []),
    thresholds: computed(() => heatmap()?.thresholds ?? { yellow: 80, red: 100 }),
    overloaded: computed(() => overloadedRows(heatmap())),
    overloadedEmployeeCount: computed(() => overloadedRows(heatmap()).length),
    /** Bars of every employee row, already stacked on the periods of the heatmap. */
    barsByEmployee: computed<Record<string, AllocationBar[]>>(() => {
      const periods = heatmap()?.periods ?? [];
      const byEmployee = new Map<string, ResourceAllocation[]>();
      for (const allocation of allocations()) {
        byEmployee.set(allocation.employee_id, [
          ...(byEmployee.get(allocation.employee_id) ?? []),
          allocation,
        ]);
      }
      return Object.fromEntries(
        [...byEmployee].map(([employeeId, list]) => [
          employeeId,
          stackBars(list, periods, granularity()),
        ]),
      );
    }),
    departments: computed(() => {
      const found = new Map<string, string>();
      for (const resource of resources()) {
        if (resource.department_id && resource.department_name) {
          found.set(resource.department_id, resource.department_name);
        }
      }
      return [...found].map(([id, name]) => ({ id, name }));
    }),
    softCount: computed(
      () => allocations().filter((allocation) => allocation.booking_type === 'SoftTentative').length,
    ),
    isEmpty: computed(() => (heatmap()?.rows.length ?? 0) === 0),
  })),
  withMethods((store, api = inject(ResourcePlanningApiService)) => {
    let sequence = 0;

    const loadView = async (): Promise<void> => {
      const ticket = ++sequence;
      const { from, to } = store.window();
      const departmentId = store.departmentId();
      patchState(store, { loading: true, error: null });
      try {
        const [heatmap, allocations] = await Promise.all([
          firstValueFrom(
            api.getHeatmap({
              from,
              to,
              granularity: store.granularity(),
              ...(departmentId ? { department_id: departmentId } : {}),
            }),
          ),
          firstValueFrom(api.getAllocations({ from, to })),
        ]);
        if (ticket === sequence) {
          patchState(store, {
            heatmap: heatmap.data,
            allocations: allocations.data,
            loading: false,
          });
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

    /** Runs a change and reloads the view; a refusal keeps the view and exposes the violated rules. */
    const mutate = async (
      call: () => Promise<AllocationMutationResult | null>,
      rejectedId: string | null,
    ): Promise<PlannerOutcome> => {
      patchState(store, {
        saving: true,
        error: null,
        lastIssues: [],
        lastResult: null,
        rejectedAllocationId: null,
      });
      try {
        const result = await call();
        patchState(store, { lastResult: result });
        await loadView();
        patchState(store, { saving: false });
        return { ok: true, result, issues: [], message: null };
      } catch (error) {
        const issues = problemIssues(error);
        const message = problemDetail(error) ?? 'resourcePlanning.saveError';
        patchState(store, {
          saving: false,
          lastIssues: issues,
          rejectedAllocationId: rejectedId,
          error: issues.length === 0 ? message : null,
        });
        return { ok: false, result: null, issues, message };
      }
    };

    return {
      async init(): Promise<void> {
        const resources = await firstValueFrom(api.getResources()).catch(() => null);
        patchState(store, { resources: resources?.data ?? [] });
        await loadView();
      },
      loadView,
      async setGranularity(granularity: HeatmapGranularity): Promise<void> {
        patchState(store, { granularity });
        await loadView();
      },
      async setDepartment(departmentId: string | null): Promise<void> {
        patchState(store, { departmentId });
        await loadView();
      },
      async navigate(direction: -1 | 1): Promise<void> {
        patchState(store, { anchor: moveAnchor(store.anchor(), store.granularity(), direction) });
        await loadView();
      },
      async goTo(anchor: string): Promise<void> {
        patchState(store, { anchor });
        await loadView();
      },
      clearFeedback(): void {
        patchState(store, {
          lastResult: null,
          lastIssues: [],
          error: null,
          rejectedAllocationId: null,
        });
      },
      /** Drag, resize and split of a booking: one call of the rebalance endpoint. */
      rebalance(allocation: ResourceAllocation, payload: RebalancePayload): Promise<PlannerOutcome> {
        return mutate(
          async () => (await firstValueFrom(api.rebalance(allocation.id, payload))).data,
          allocation.id,
        );
      },
      /** Soft to hard: the project is needed only when the soft booking holds just an opportunity. */
      convertToHard(
        allocation: ResourceAllocation,
        payload: ConvertToHardPayload = {},
      ): Promise<PlannerOutcome> {
        return mutate(
          async () => (await firstValueFrom(api.convertToHard(allocation.id, payload))).data,
          allocation.id,
        );
      },
      remove(allocation: ResourceAllocation): Promise<PlannerOutcome> {
        return mutate(async () => {
          await firstValueFrom(api.deleteAllocation(allocation.id));
          return null;
        }, allocation.id);
      },
      create(payload: AllocationPayload): Promise<PlannerOutcome> {
        return mutate(async () => (await firstValueFrom(api.createAllocation(payload))).data, null);
      },
    };
  }),
);
