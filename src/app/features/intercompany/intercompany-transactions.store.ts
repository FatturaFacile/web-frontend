import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IcMirrorMode,
  IcNettingPayload,
  IcNettingRun,
  IcScanResult,
  IcTransaction,
  IcTransactionFilters,
  IcTransactionSummary,
  IntercompanyApiService,
} from '@core';
import { attempt, IcOutcome } from './intercompany.util';

export interface IntercompanyTransactionsState {
  transactions: IcTransaction[];
  summary: IcTransactionSummary | null;
  total: number;
  filters: IcTransactionFilters;
  detail: IcTransaction | null;
  nettingRuns: IcNettingRun[];
  /** Ids with a write in flight. */
  busy: string[];
  loading: boolean;
  error: string | null;
  lastScan: Pick<IcScanResult, 'created' | 'skipped' | 'failed'> | null;
}

const initialState: IntercompanyTransactionsState = {
  transactions: [],
  summary: null,
  total: 0,
  filters: { page: 1, per_page: 20 },
  detail: null,
  nettingRuns: [],
  busy: [],
  loading: false,
  error: null,
  lastScan: null,
};

/** Mirror postings of a group: the linked documents, their payment sync, and the netting (compensation) runs. */
export const IntercompanyTransactionsStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(IntercompanyApiService)) => {
    const replace = (updated: IcTransaction): void => {
      patchState(store, {
        transactions: store
          .transactions()
          .map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
        detail:
          store.detail()?.id === updated.id ? { ...store.detail(), ...updated } : store.detail(),
      });
    };

    const mark = async (id: string, call: () => Promise<IcTransaction>): Promise<IcOutcome> => {
      patchState(store, { busy: [...store.busy(), id], error: null });
      const { outcome, value } = await attempt(call);
      patchState(store, { busy: store.busy().filter((item) => item !== id) });
      if (value !== null) {
        replace(value);
      }
      return outcome;
    };

    const methods = {
      async load(groupId: string, filters: IcTransactionFilters = store.filters()): Promise<void> {
        patchState(store, { loading: true, error: null, filters });
        const { outcome, value } = await attempt(() =>
          firstValueFrom(api.getTransactions(groupId, filters)),
        );
        if (value === null) {
          patchState(store, { loading: false, error: outcome.errorKey });
          return;
        }
        patchState(store, {
          transactions: value.data ?? [],
          summary: value.meta?.summary ?? null,
          total: value.meta?.total ?? value.data?.length ?? 0,
          loading: false,
        });
      },
      async scan(groupId: string, range: { from?: string; to?: string } = {}): Promise<IcOutcome> {
        patchState(store, { loading: true });
        const { outcome, value } = await attempt(() =>
          firstValueFrom(api.scanTransactions(groupId, range)),
        );
        patchState(store, {
          loading: false,
          lastScan:
            value === null
              ? null
              : {
                  created: value.data.created,
                  skipped: value.data.skipped,
                  failed: value.data.failed,
                },
        });
        if (value !== null) {
          await methods.load(groupId, { ...store.filters(), page: 1 });
        }
        return outcome;
      },
      mirror(id: string, mode?: IcMirrorMode): Promise<IcOutcome> {
        const version = store.transactions().find((row) => row.id === id)?.version;
        return mark(
          id,
          async () =>
            (await firstValueFrom(api.mirrorTransaction(id, { mode, expected_version: version })))
              .data,
        );
      },
      confirm(id: string): Promise<IcOutcome> {
        const version = store.transactions().find((row) => row.id === id)?.version;
        return mark(
          id,
          async () => (await firstValueFrom(api.confirmTransaction(id, version))).data,
        );
      },
      reverse(id: string, reason: string): Promise<IcOutcome> {
        const version = store.transactions().find((row) => row.id === id)?.version;
        return mark(
          id,
          async () => (await firstValueFrom(api.reverseTransaction(id, reason, version))).data,
        );
      },
      syncPayment(id: string): Promise<IcOutcome> {
        return mark(id, async () => (await firstValueFrom(api.syncPayment(id))).data);
      },
      async openDetail(id: string): Promise<void> {
        const { value } = await attempt(() => firstValueFrom(api.getTransaction(id)));
        patchState(store, { detail: value?.data ?? null });
      },
      closeDetail(): void {
        patchState(store, { detail: null });
      },

      // --- Netting ---
      async loadNetting(groupId: string): Promise<void> {
        const { value } = await attempt(() => firstValueFrom(api.getNettingRuns(groupId)));
        if (value !== null) {
          patchState(store, { nettingRuns: value.data ?? [] });
        }
      },
      async proposeNetting(
        groupId: string,
        payload: IcNettingPayload,
      ): Promise<IcOutcome & { run: IcNettingRun | null }> {
        const { outcome, value } = await attempt(() =>
          firstValueFrom(api.proposeNetting(groupId, payload)),
        );
        if (value !== null) {
          patchState(store, { nettingRuns: [value.data, ...store.nettingRuns()] });
        }
        return { ...outcome, run: value?.data ?? null };
      },
      async confirmNetting(id: string): Promise<IcOutcome> {
        const version = store.nettingRuns().find((run) => run.id === id)?.version;
        const { outcome, value } = await attempt(() =>
          firstValueFrom(api.confirmNetting(id, version)),
        );
        if (value !== null) {
          patchState(store, {
            nettingRuns: store.nettingRuns().map((run) => (run.id === id ? value.data : run)),
          });
        }
        return outcome;
      },
      async cancelNetting(id: string, reason: string): Promise<IcOutcome> {
        const { outcome, value } = await attempt(() =>
          firstValueFrom(api.cancelNetting(id, reason)),
        );
        if (value !== null) {
          patchState(store, {
            nettingRuns: store.nettingRuns().map((run) => (run.id === id ? value.data : run)),
          });
        }
        return outcome;
      },
    };
    return methods;
  }),
);
