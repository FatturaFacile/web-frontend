import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ConsolidationGroup,
  ConsolidationRun,
  GeneralLedgerConsolidationApiService,
  IcLookups,
  IntercompanyApiService,
} from '@core';

export interface IntercompanyContextState {
  groups: ConsolidationGroup[];
  runs: ConsolidationRun[];
  groupId: string | null;
  runId: string | null;
  lookups: IcLookups | null;
  loading: boolean;
  error: string | null;
}

const initialState: IntercompanyContextState = {
  groups: [],
  runs: [],
  groupId: null,
  runId: null,
  lookups: null,
  loading: false,
  error: null,
};

/**
 * The group and the consolidation run every intercompany page works on. Groups and runs come from the existing
 * general-ledger consolidation API; the page stores read `groupId` and `runId` from here.
 */
export const IntercompanyContextStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    group: computed(() => store.groups().find((group) => group.id === store.groupId()) ?? null),
    run: computed(() => store.runs().find((run) => run.id === store.runId()) ?? null),
    groupCurrency: computed(
      () => store.groups().find((group) => group.id === store.groupId())?.group_currency ?? 'CHF',
    ),
    members: computed(
      () => store.groups().find((group) => group.id === store.groupId())?.members ?? [],
    ),
  })),
  withMethods(
    (
      store,
      consolidation = inject(GeneralLedgerConsolidationApiService),
      api = inject(IntercompanyApiService),
    ) => {
      const loadRuns = async (groupId: string): Promise<void> => {
        try {
          const runs = (await firstValueFrom(consolidation.getRuns(groupId))).data ?? [];
          const keep = runs.some((run) => run.id === store.runId());
          patchState(store, { runs, runId: keep ? store.runId() : (runs[0]?.id ?? null) });
        } catch {
          patchState(store, { runs: [], runId: null });
        }
      };

      return {
        async loadGroups(): Promise<void> {
          patchState(store, { loading: true, error: null });
          try {
            const groups = (await firstValueFrom(consolidation.getGroups())).data ?? [];
            const groupId = store.groupId() ?? groups[0]?.id ?? null;
            patchState(store, { groups, groupId, loading: false });
            if (groupId !== null) {
              await loadRuns(groupId);
            }
          } catch {
            patchState(store, { loading: false, error: 'intercompany.error.generic' });
          }
        },
        async loadLookups(): Promise<void> {
          if (store.lookups() !== null) {
            return;
          }
          try {
            patchState(store, { lookups: (await firstValueFrom(api.getLookups())).data });
          } catch {
            patchState(store, { error: 'intercompany.error.generic' });
          }
        },
        async selectGroup(groupId: string | null): Promise<void> {
          patchState(store, { groupId, runs: [], runId: null });
          if (groupId !== null) {
            await loadRuns(groupId);
          }
        },
        selectRun(runId: string | null): void {
          patchState(store, { runId });
        },
        /** Reloads the runs of the group (after a run is started or its workflow moves). */
        async refreshRuns(): Promise<void> {
          const groupId = store.groupId();
          if (groupId !== null) {
            await loadRuns(groupId);
          }
        },
        /** Entity name of a member of the group, the id when it is unknown. */
        memberName(tenantId: string | null | undefined): string {
          if (!tenantId) {
            return '';
          }
          const group = store.groups().find((candidate) => candidate.id === store.groupId());
          return (
            group?.members?.find((member) => member.member_tenant_id === tenantId)?.name ?? tenantId
          );
        },
      };
    },
  ),
);
