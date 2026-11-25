import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IcMatrix,
  IcMatrixCell,
  IcReconciliationBatch,
  IcReconciliationItem,
  IcReconciliationItemFilters,
  IntercompanyApiService,
} from '@core';
import { attempt, IcOutcome } from './intercompany.util';

export interface IntercompanyReconciliationState {
  batches: IcReconciliationBatch[];
  batch: IcReconciliationBatch | null;
  matrix: IcMatrix | null;
  filters: IcReconciliationItemFilters;
  /** The cell of the matrix whose items are listed (drill-down). */
  cell: Pick<IcMatrixCell, 'entity_a_tenant_id' | 'entity_b_tenant_id'> | null;
  busy: string[];
  loading: boolean;
  error: string | null;
}

const initialState: IntercompanyReconciliationState = {
  batches: [],
  batch: null,
  matrix: null,
  filters: {},
  cell: null,
  busy: [],
  loading: false,
  error: null,
};

/** The reciprocal reconciliation cockpit: batches, the quadrature matrix of every pair of entities and the manual resolutions. */
export const IntercompanyReconciliationStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    items: computed<IcReconciliationItem[]>(() => store.batch()?.items ?? []),
    cellOf: computed(() => (a: string, b: string): IcMatrixCell | null => {
      const cells = store.matrix()?.cells ?? [];
      return (
        cells.find((cell) => cell.entity_a_tenant_id === a && cell.entity_b_tenant_id === b) ?? null
      );
    }),
  })),
  withMethods((store, api = inject(IntercompanyApiService)) => {
    const loadBatch = async (id: string, filters: IcReconciliationItemFilters): Promise<void> => {
      const { outcome, value } = await attempt(() => firstValueFrom(api.getBatch(id, filters)));
      patchState(store, { batch: value?.data ?? store.batch(), error: outcome.errorKey });
    };

    const resolve = async (
      item: IcReconciliationItem,
      call: () => Promise<IcReconciliationItem>,
    ): Promise<IcOutcome> => {
      patchState(store, { busy: [...store.busy(), item.id] });
      const { outcome, value } = await attempt(call);
      patchState(store, { busy: store.busy().filter((id) => id !== item.id) });
      const batch = store.batch();
      if (value !== null && batch !== null) {
        patchState(store, {
          batch: {
            ...batch,
            items: (batch.items ?? []).map((row) => (row.id === value.id ? value : row)),
          },
        });
        // The totals of the batch and the matrix move with the item.
        void loadBatch(batch.id, store.filters());
        void api
          .getMatrix(batch.group_id, batch.as_of_date)
          .subscribe({ next: (response) => patchState(store, { matrix: response.data }) });
      }
      return outcome;
    };

    const methods = {
      async load(groupId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        const { outcome, value } = await attempt(() => firstValueFrom(api.getBatches(groupId)));
        patchState(store, { batches: value?.data ?? [], loading: false, error: outcome.errorKey });
        const latest = value?.data?.[0];
        if (latest) {
          await methods.openBatch(latest.id);
          await methods.loadMatrix(groupId, latest.as_of_date);
        } else {
          patchState(store, { batch: null, matrix: null });
        }
      },
      async openBatch(id: string): Promise<void> {
        patchState(store, { loading: true });
        await loadBatch(id, store.filters());
        patchState(store, { loading: false });
      },
      async loadMatrix(groupId: string, asOfDate?: string): Promise<void> {
        const { value } = await attempt(() => firstValueFrom(api.getMatrix(groupId, asOfDate)));
        patchState(store, { matrix: value?.data ?? null });
      },
      /** Starts a reconciliation batch (automatic matching included by default) and shows it. */
      async runBatch(groupId: string, asOfDate: string, autoMatch = true): Promise<IcOutcome> {
        patchState(store, { loading: true, error: null });
        const { outcome, value } = await attempt(() =>
          firstValueFrom(api.createBatch(groupId, asOfDate, autoMatch)),
        );
        if (value === null) {
          patchState(store, { loading: false, error: outcome.errorKey });
          return outcome;
        }
        patchState(store, { batches: [value.data, ...store.batches()], cell: null, filters: {} });
        await loadBatch(value.data.id, {});
        await methods.loadMatrix(groupId, asOfDate);
        patchState(store, { loading: false });
        return outcome;
      },
      /** Filters by anomaly type and status; the cell of the matrix (a pair of entities) is part of the filter. */
      async applyFilters(filters: IcReconciliationItemFilters): Promise<void> {
        patchState(store, { filters });
        const batch = store.batch();
        if (batch !== null) {
          await loadBatch(batch.id, filters);
        }
      },
      async drillDown(
        cell: Pick<IcMatrixCell, 'entity_a_tenant_id' | 'entity_b_tenant_id'> | null,
      ): Promise<void> {
        patchState(store, { cell });
        await methods.applyFilters({
          ...store.filters(),
          entity_a_tenant_id: cell?.entity_a_tenant_id,
          entity_b_tenant_id: cell?.entity_b_tenant_id,
        });
      },
      match(item: IcReconciliationItem, counterpartDocumentId: string): Promise<IcOutcome> {
        return resolve(
          item,
          async () => (await firstValueFrom(api.matchItem(item.id, counterpartDocumentId))).data,
        );
      },
      unmatch(item: IcReconciliationItem): Promise<IcOutcome> {
        return resolve(item, async () => (await firstValueFrom(api.unmatchItem(item.id))).data);
      },
      dispute(item: IcReconciliationItem, reason: string): Promise<IcOutcome> {
        return resolve(
          item,
          async () => (await firstValueFrom(api.disputeItem(item.id, reason))).data,
        );
      },
      writeOff(item: IcReconciliationItem, reason: string): Promise<IcOutcome> {
        return resolve(
          item,
          async () => (await firstValueFrom(api.writeOffItem(item.id, reason))).data,
        );
      },
      adjust(item: IcReconciliationItem, reason: string, amount: string): Promise<IcOutcome> {
        return resolve(
          item,
          async () => (await firstValueFrom(api.adjustItem(item.id, reason, amount))).data,
        );
      },
    };
    return methods;
  }),
);
