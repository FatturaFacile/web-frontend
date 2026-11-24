import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectPortfolioApiService } from './portfolio-api.service';
import {
  BaselineNodeDates,
  BaselineVariance,
  DependencyPayload,
  Project,
  ProjectBaseline,
  TaskDependency,
  WbsNode,
  WbsNodePayload,
} from './portfolio.models';
import { DragMode, dragDates, flattenTree, MoveAction, parentIds, reorderItems, rollupTotals, schedule, wouldCreateCycle } from './portfolio.utils';

interface WorkspaceState {
  projectId: string | null;
  project: Project | null;
  nodes: WbsNode[];
  dependencies: TaskDependency[];
  baselines: ProjectBaseline[];
  /** The baseline overlaid on the Gantt, with the dates it froze. */
  baselineId: string | null;
  baselineNodes: BaselineNodeDates[];
  variance: BaselineVariance | null;
  expanded: Set<string>;
  selectedNodeId: string | null;
  loading: boolean;
  saving: boolean;
  /** `true` while a bar is dragged: the schedule is a local preview that the API has not confirmed yet. */
  previewing: boolean;
  cyclic: boolean;
  error: boolean;
}

const initialState: WorkspaceState = {
  projectId: null,
  project: null,
  nodes: [],
  dependencies: [],
  baselines: [],
  baselineId: null,
  baselineNodes: [],
  variance: null,
  expanded: new Set<string>(),
  selectedNodeId: null,
  loading: false,
  saving: false,
  previewing: false,
  cyclic: false,
  error: false,
};

/**
 * State of one project workspace (Mod 078): WBS tree, dependencies, Gantt with the CPM, baseline overlay and Kanban.
 * Every mutation goes to the API and then reloads the schedule, so the server-side CPM stays the source of truth;
 * dragging a bar only previews the cascade locally (`previewMove`) until it is committed with `commitMove`.
 */
export const ProjectWorkspaceStore = signalStore(
  withState<WorkspaceState>(initialState),
  withComputed((store) => ({
    rows: computed(() => flattenTree(store.nodes(), store.expanded())),
    totals: computed(() => rollupTotals(store.nodes())),
    allExpanded: computed(() => {
      const parents = parentIds(store.nodes());

      return parents.length > 0 && parents.every((id) => store.expanded().has(id));
    }),
    selectedNode: computed(() => store.nodes().find((node) => node.id === store.selectedNodeId()) ?? null),
    criticalCount: computed(() => store.nodes().filter((node) => node.isCritical).length),
    baselineByNode: computed(() => new Map(store.baselineNodes().map((entry) => [entry.nodeId, entry]))),
  })),
  withMethods((store, api = inject(ProjectPortfolioApiService)) => {
    let origin: WbsNode[] | null = null;

    /** Runs a write call, keeps `saving` honest and reports whether it worked. */
    const write = async (call: () => Promise<unknown>): Promise<boolean> => {
      patchState(store, { saving: true });

      try {
        await call();

        return true;
      } catch {
        return false;
      } finally {
        patchState(store, { saving: false });
      }
    };

    const loadGantt = async (): Promise<void> => {
      const id = store.projectId();

      if (id === null) {
        return;
      }

      const response = await firstValueFrom(api.gantt(id, store.baselineId()));
      const data = response.data;
      const expanded = store.expanded().size === 0 ? new Set(parentIds(data.nodes)) : store.expanded();

      patchState(store, {
        project: data.project,
        nodes: data.nodes,
        dependencies: data.dependencies,
        baselineNodes: data.baseline?.nodes ?? [],
        expanded,
        cyclic: false,
        previewing: false,
      });
    };

    const reload = async (): Promise<boolean> => {
      try {
        await loadGantt();

        return true;
      } catch {
        patchState(store, { error: true });

        return false;
      }
    };

    return {
      async load(projectId: string): Promise<void> {
        patchState(store, { ...initialState, expanded: new Set<string>(), projectId, loading: true });

        try {
          await loadGantt();
          const baselines = await firstValueFrom(api.baselines(projectId));
          patchState(store, { baselines: baselines.data });
        } catch {
          patchState(store, { error: true });
        } finally {
          patchState(store, { loading: false });
        }
      },

      /** Reloads the schedule as the API computed it (after a failed drop, for instance). */
      reload,

      toggle(id: string): void {
        const next = new Set(store.expanded());

        if (!next.delete(id)) {
          next.add(id);
        }

        patchState(store, { expanded: next });
      },

      toggleAll(): void {
        patchState(store, { expanded: store.allExpanded() ? new Set<string>() : new Set(parentIds(store.nodes())) });
      },

      select(id: string | null): void {
        patchState(store, { selectedNodeId: id });
      },

      async selectBaseline(baselineId: string | null): Promise<boolean> {
        patchState(store, { baselineId, variance: null });

        const loaded = await write(async () => {
          await loadGantt();

          if (baselineId !== null && store.projectId() !== null) {
            const variance = await firstValueFrom(api.variance(store.projectId() as string, baselineId));
            patchState(store, { variance: variance.data });
          }
        });

        return loaded;
      },

      async captureBaseline(name: string): Promise<boolean> {
        const id = store.projectId();

        if (id === null) {
          return false;
        }

        return write(async () => {
          await firstValueFrom(api.captureBaseline(id, name));
          const baselines = await firstValueFrom(api.baselines(id));
          patchState(store, { baselines: baselines.data });
        });
      },

      async saveAsTemplate(code: string, name: string): Promise<boolean> {
        const id = store.projectId();

        if (id === null) {
          return false;
        }

        return write(async () => {
          await firstValueFrom(api.saveTemplate({ code, name, sourceProjectId: id }));
        });
      },

      /** Local cascade while a bar is dragged: moves the node, then lets the CPM push its successors. */
      previewMove(nodeId: string, mode: DragMode, deltaDays: number): void {
        origin ??= store.nodes();
        const base = origin;
        const node = base.find((candidate) => candidate.id === nodeId);

        if (node === undefined) {
          return;
        }

        const moved = base.map((candidate) => (candidate.id === nodeId ? { ...candidate, ...dragDates(candidate, mode, deltaDays) } : candidate));
        const result = schedule(moved, store.dependencies());

        patchState(store, { nodes: result.cyclic ? moved : result.nodes, cyclic: result.cyclic, previewing: true });
      },

      cancelMove(): void {
        if (origin !== null) {
          patchState(store, { nodes: origin, previewing: false, cyclic: false });
        }

        origin = null;
      },

      /** Sends the dropped dates to the API, asks the CPM to recalculate and reloads the schedule it computed. */
      async commitMove(nodeId: string): Promise<boolean> {
        const id = store.projectId();
        const node = store.nodes().find((candidate) => candidate.id === nodeId);
        origin = null;

        if (id === null || node === undefined) {
          return false;
        }

        const done = await write(async () => {
          await firstValueFrom(api.updateNode(id, nodeId, { startDate: node.startDate, endDate: node.endDate }));
          await firstValueFrom(api.recalculate(id));
          await loadGantt();
        });

        if (!done) {
          await reload();
        }

        return done;
      },

      async recalculate(): Promise<boolean> {
        const id = store.projectId();

        return id === null ? false : write(async () => {
          await firstValueFrom(api.recalculate(id));
          await loadGantt();
        });
      },

      async saveNode(payload: WbsNodePayload, nodeId?: string): Promise<boolean> {
        const id = store.projectId();

        return id === null ? false : write(async () => {
          await firstValueFrom(nodeId === undefined ? api.createNode(id, payload) : api.updateNode(id, nodeId, payload));
          await loadGantt();
        });
      },

      async deleteNode(nodeId: string): Promise<boolean> {
        const id = store.projectId();

        return id === null ? false : write(async () => {
          await firstValueFrom(api.deleteNode(id, nodeId));
          patchState(store, { selectedNodeId: store.selectedNodeId() === nodeId ? null : store.selectedNodeId() });
          await loadGantt();
        });
      },

      async moveNode(nodeId: string, action: MoveAction): Promise<boolean> {
        const id = store.projectId();
        const items = reorderItems(store.nodes(), nodeId, action);

        if (id === null || items.length === 0) {
          return false;
        }

        return write(async () => {
          await firstValueFrom(api.reorderNodes(id, items));
          await loadGantt();
        });
      },

      /** Adds a dependency; a link that would close a loop is refused before the API is called. */
      async addDependency(payload: DependencyPayload): Promise<'created' | 'cycle' | 'failed'> {
        const id = store.projectId();

        if (id === null) {
          return 'failed';
        }

        if (wouldCreateCycle(store.dependencies(), payload.predecessorNodeId, payload.successorNodeId)) {
          return 'cycle';
        }

        return (await write(async () => {
          await firstValueFrom(api.createDependency(id, payload));
          await loadGantt();
        }))
          ? 'created'
          : 'failed';
      },

      async updateDependency(dependencyId: string, payload: Pick<DependencyPayload, 'dependencyType' | 'lagDays'>): Promise<boolean> {
        const id = store.projectId();

        return id === null ? false : write(async () => {
          await firstValueFrom(api.updateDependency(id, dependencyId, payload));
          await loadGantt();
        });
      },

      async deleteDependency(dependencyId: string): Promise<boolean> {
        const id = store.projectId();

        return id === null ? false : write(async () => {
          await firstValueFrom(api.deleteDependency(id, dependencyId));
          await loadGantt();
        });
      },
    };
  }),
);
