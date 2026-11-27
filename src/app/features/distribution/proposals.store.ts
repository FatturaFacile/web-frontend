import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DistributionApiService,
  DstGenerateResult,
  DstLookups,
  DstProposal,
  DstProposalFilters,
  DstTransfer,
} from '@core';
import { attempt, DstOutcome, failureOf } from './distribution.util';

export interface ProposalsState {
  proposals: DstProposal[];
  filters: DstProposalFilters;
  selectedIds: string[];
  lookups: DstLookups | null;
  lastGenerated: DstGenerateResult | null;
  lastTransfers: DstTransfer[];
  lastShortfalls: DstProposal[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The workbench of replenishment and balancing proposals: inspect, adjust, reject and bulk-approve into transfers. */
export const ProposalsStore = signalStore(
  withState<ProposalsState>({
    proposals: [],
    filters: { status: 'pending' },
    selectedIds: [],
    lookups: null,
    lastGenerated: null,
    lastTransfers: [],
    lastShortfalls: [],
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listProposals(store.filters()));
        const stillThere = new Set(response.data.map((proposal) => proposal.id));
        patchState(store, {
          proposals: response.data,
          selectedIds: store.selectedIds().filter((id) => stillThere.has(id)),
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<DstOutcome> => {
      patchState(store, { saving: true });
      const outcome = await attempt(call);
      patchState(store, { saving: false });
      if (outcome.ok) {
        await load();
      }
      return outcome;
    };

    return {
      load,
      async init(): Promise<void> {
        try {
          patchState(store, { lookups: (await firstValueFrom(api.getLookups())).data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
        await load();
      },
      setFilters(filters: DstProposalFilters): Promise<void> {
        patchState(store, { filters });
        return load();
      },
      toggle(id: string, selected: boolean): void {
        const without = store.selectedIds().filter((value) => value !== id);
        patchState(store, { selectedIds: selected ? [...without, id] : without });
      },
      /** Only pending proposals can be approved, so the select-all picks those. */
      toggleAll(selected: boolean): void {
        patchState(store, {
          selectedIds: selected
            ? store
                .proposals()
                .filter((proposal) => proposal.status === 'pending')
                .map((proposal) => proposal.id)
            : [],
        });
      },
      async generate(warehouseIds?: string[], stockItemIds?: string[]): Promise<DstOutcome> {
        const payload = {
          ...(warehouseIds?.length ? { warehouse_ids: warehouseIds } : {}),
          ...(stockItemIds?.length ? { stock_item_ids: stockItemIds } : {}),
        };
        return write(async () => {
          const response = await firstValueFrom(api.generateProposals(payload));
          patchState(store, { lastGenerated: response.data });
        });
      },
      adjust: (id: string, quantity: number): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.updateProposal(id, quantity))),
      reject: (id: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.rejectProposal(id))),
      async approveSelected(transferStatus: 'draft' | 'approved'): Promise<DstOutcome> {
        const ids = store.selectedIds();
        if (ids.length === 0) {
          return failureOf(null);
        }
        return write(async () => {
          const response = await firstValueFrom(api.approveProposals(ids, transferStatus));
          patchState(store, {
            lastTransfers: response.data.transfers,
            lastShortfalls: response.data.shortfalls,
            selectedIds: [],
          });
        });
      },
      async detail(id: string): Promise<DstProposal | null> {
        try {
          return (await firstValueFrom(api.getProposal(id))).data;
        } catch {
          return null;
        }
      },
    };
  }),
);
