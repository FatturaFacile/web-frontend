import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DistributionApiService,
  DstBucketType,
  DstDrpAlert,
  DstDrpGrid,
  DstDrpRun,
  DstLookups,
} from '@core';
import { attempt, DstOutcome, failureOf } from './distribution.util';

export interface DrpState {
  runs: DstDrpRun[];
  run: DstDrpRun | null;
  grid: DstDrpGrid | null;
  alerts: DstDrpAlert[];
  warehouseId: string | null;
  stockItemId: string | null;
  bucketType: DstBucketType;
  horizon: number;
  lookups: DstLookups | null;
  loading: boolean;
  running: boolean;
  error: string | null;
}

/** The time-phased DRP matrix of a run, with the stockout, excess and late-inbound alerts. */
export const DrpStore = signalStore(
  withState<DrpState>({
    runs: [],
    run: null,
    grid: null,
    alerts: [],
    warehouseId: null,
    stockItemId: null,
    bucketType: 'weekly',
    horizon: 8,
    lookups: null,
    loading: false,
    running: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const loadRun = async (run: DstDrpRun): Promise<void> => {
      const [grid, alerts] = await Promise.all([
        firstValueFrom(api.getDrpGrid(run.id, store.warehouseId(), store.stockItemId())),
        firstValueFrom(api.listDrpAlerts(run.id)),
      ]);
      patchState(store, { run, grid: grid.data, alerts: alerts.data });
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [lookups, runs] = await Promise.all([
            firstValueFrom(api.getLookups()),
            firstValueFrom(api.listDrpRuns()),
          ]);
          patchState(store, { lookups: lookups.data, runs: runs.data });
          if (runs.data.length > 0) {
            await loadRun(runs.data[0]);
          }
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      async selectRun(id: string): Promise<void> {
        const run = store.runs().find((candidate) => candidate.id === id);
        if (!run) {
          return;
        }
        patchState(store, { loading: true, error: null });
        try {
          await loadRun(run);
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      /** Narrows the grid to a warehouse and/or an item and reloads the current run. */
      async setScope(warehouseId: string | null, stockItemId: string | null): Promise<void> {
        patchState(store, { warehouseId, stockItemId });
        const run = store.run();
        if (!run) {
          return;
        }
        patchState(store, { loading: true, error: null });
        try {
          await loadRun(run);
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      setBucket(bucketType: DstBucketType, horizon: number): void {
        patchState(store, { bucketType, horizon });
      },
      async execute(): Promise<DstOutcome> {
        patchState(store, { running: true });
        const warehouseId = store.warehouseId();
        const stockItemId = store.stockItemId();
        const outcome = await attempt(async () => {
          const response = await firstValueFrom(
            api.runDrp({
              bucket_type: store.bucketType(),
              horizon: store.horizon(),
              ...(warehouseId ? { warehouse_ids: [warehouseId] } : {}),
              ...(stockItemId ? { stock_item_ids: [stockItemId] } : {}),
            }),
          );
          const runs = await firstValueFrom(api.listDrpRuns());
          patchState(store, { runs: runs.data });
          await loadRun(response.data);
        });
        patchState(store, { running: false });
        return outcome;
      },
    };
  }),
);
