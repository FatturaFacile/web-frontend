import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DistributionApiService,
  DstAvailability,
  DstDispatchPayload,
  DstLane,
  DstLookups,
  DstReceivePayload,
  DstStatusCounts,
  DstTransfer,
  DstTransferFilters,
  DstTransferPayload,
  DstTransferStatus,
} from '@core';
import { attempt, DST_OK, DstOutcome, failureOf } from './distribution.util';

export interface TransfersState {
  transfers: DstTransfer[];
  statusCounts: DstStatusCounts;
  total: number;
  status: DstTransferStatus | null;
  query: string;
  page: number;
  lookups: DstLookups | null;
  lanes: DstLane[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Transfers between warehouses: the list by status and the workflow actions (approve, dispatch, receive, cancel). */
export const TransfersStore = signalStore(
  withState<TransfersState>({
    transfers: [],
    statusCounts: {},
    total: 0,
    status: null,
    query: '',
    page: 1,
    lookups: null,
    lanes: [],
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const filters = (): DstTransferFilters => ({
      status: store.status(),
      q: store.query() || null,
      page: store.page(),
    });

    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listTransfers(filters()));
        patchState(store, {
          transfers: response.data,
          statusCounts: response.meta.status_counts ?? {},
          total: response.meta.total ?? response.data.length,
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
      async loadReferences(): Promise<void> {
        try {
          const [lookups, lanes] = await Promise.all([
            firstValueFrom(api.getLookups()),
            firstValueFrom(api.listLanes()),
          ]);
          patchState(store, { lookups: lookups.data, lanes: lanes.data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      setStatus(status: DstTransferStatus | null): Promise<void> {
        patchState(store, { status, page: 1 });
        return load();
      },
      setQuery(query: string): Promise<void> {
        patchState(store, { query, page: 1 });
        return load();
      },
      setPage(page: number): Promise<void> {
        patchState(store, { page });
        return load();
      },
      /** Lead time of the lane between two warehouses (days, hours), null when there is no lane. */
      laneBetween(sourceId: string | null, destinationId: string | null): DstLane | null {
        if (!sourceId || !destinationId) {
          return null;
        }
        return (
          store
            .lanes()
            .find(
              (lane) =>
                lane.is_active &&
                lane.source_warehouse_id === sourceId &&
                lane.destination_warehouse_id === destinationId,
            ) ?? null
        );
      },
      async availability(
        warehouseId: string,
        stockItemId: string,
      ): Promise<DstAvailability | null> {
        try {
          return (await firstValueFrom(api.getAvailability(warehouseId, stockItemId))).data;
        } catch {
          return null;
        }
      },
      create: (payload: DstTransferPayload): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.createTransfer(payload))),
      approve: (id: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.approveTransfer(id))),
      dispatch: (id: string, payload: DstDispatchPayload): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.dispatchTransfer(id, payload))),
      receive: (id: string, payload: DstReceivePayload): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.receiveTransfer(id, payload))),
      cancel: (id: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.cancelTransfer(id))),
      clearError(): DstOutcome {
        patchState(store, { error: null });
        return DST_OK;
      },
    };
  }),
);
