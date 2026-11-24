import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AgcAgentProfile,
  AgcLedgerEntry,
  AgcLedgerFilters,
  AgcLedgerTotals,
  AgcPageMeta,
  AgcSyncPayload,
  AgentCommissionsApiService,
} from '@core';
import { AGC_OK, AgcOutcome, agentName, failureOf } from './agent-commissions.util';

export interface LedgerState {
  filters: AgcLedgerFilters;
  entries: AgcLedgerEntry[];
  meta: AgcPageMeta | null;
  totals: AgcLedgerTotals | null;
  agents: AgcAgentProfile[];
  /** The entry open in the detail drawer, with its movements. */
  detail: AgcLedgerEntry | null;
  loading: boolean;
  loadingDetail: boolean;
  syncing: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

const initialState: LedgerState = {
  filters: { per_page: PAGE_SIZE, page: 1 },
  entries: [],
  meta: null,
  totals: null,
  agents: [],
  detail: null,
  loading: false,
  loadingDetail: false,
  syncing: false,
  error: null,
};

/** The commission ledger: accrued commission per invoice, invoiced or collected, with the bank-reconciliation lock. */
export const LedgerStore = signalStore(
  withState(initialState),
  withComputed(({ meta, agents }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    agentOptions: computed(() =>
      agents().map((agent) => ({ id: agent.id, name: agentName(agent) })),
    ),
  })),
  withMethods((store, api = inject(AgentCommissionsApiService)) => {
    let sequence = 0;

    const load = async (filters: AgcLedgerFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listLedger(filters));
        if (ticket === sequence) {
          const { totals, ...meta } = response.meta;
          patchState(store, { entries: response.data, meta, totals, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    return {
      async init(): Promise<void> {
        const agents = await firstValueFrom(api.listAgents()).catch(() => null);
        patchState(store, { agents: agents?.data ?? [] });
        await load(store.filters());
      },
      load: (filters: AgcLedgerFilters = store.filters()): Promise<void> => load(filters),
      /** Applies filters from the first page. */
      setFilters(patch: Partial<AgcLedgerFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      async openDetail(id: string): Promise<void> {
        patchState(store, { loadingDetail: true, detail: null });
        try {
          const response = await firstValueFrom(api.getLedgerEntry(id));
          patchState(store, { loadingDetail: false, detail: response.data });
        } catch (error) {
          patchState(store, { loadingDetail: false, error: (await failureOf(error)).errorKey });
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null, loadingDetail: false });
      },
      /** Accrues the invoices of the period and re-reads the collections, then reloads the ledger. */
      async sync(payload: AgcSyncPayload = {}): Promise<AgcOutcome> {
        patchState(store, { syncing: true });
        try {
          await firstValueFrom(api.sync(payload));
          patchState(store, { syncing: false });
          await load(store.filters());
          return AGC_OK;
        } catch (error) {
          patchState(store, { syncing: false });
          return failureOf(error);
        }
      },
    };
  }),
);
