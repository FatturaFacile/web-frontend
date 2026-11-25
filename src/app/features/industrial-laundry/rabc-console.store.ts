import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IlrBatchPayload,
  IlrCertifyPayload,
  IlrCustomerRef,
  IlrProgram,
  IlrRollCage,
  IlrScanPayload,
  IlrScanSession,
  IlrWashBatch,
  IndustrialLaundryApiService,
} from '@core';
import { failureOf, ILR_OK, IlrOutcome } from './industrial-laundry.util';

export interface RabcConsoleState {
  customers: IlrCustomerRef[];
  programs: IlrProgram[];
  cages: IlrRollCage[];
  sessions: IlrScanSession[];
  batches: IlrWashBatch[];
  lastScan: IlrScanSession | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export type ScanOutcome = IlrOutcome & { session: IlrScanSession | null };

/** The RFID roll cage scan console and the UNI EN 14065 RABC batch certificates. */
export const RabcConsoleStore = signalStore(
  withState<RabcConsoleState>({
    customers: [],
    programs: [],
    cages: [],
    sessions: [],
    batches: [],
    lastScan: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ sessions, cages, customers, programs }) => ({
    soiledSessions: computed(() => sessions().filter((session) => session.direction === 'inbound_soil')),
    tareOf: computed(
      () =>
        (barcode: string): string | null =>
          cages().find((cage) => cage.barcode === barcode)?.tare_weight_kg?.toString() ?? null,
    ),
    customerName: computed(
      () =>
        (id: string | null): string =>
          customers().find((customer) => customer.id === id)?.name ?? '',
    ),
    program: computed(() => (code: string): IlrProgram | null => programs().find((item) => item.code === code) ?? null),
  })),
  withMethods((store, api = inject(IndustrialLaundryApiService)) => {
    const loadSessions = async (): Promise<void> => {
      const response = await firstValueFrom(api.listScans({ per_page: 50 }));
      patchState(store, { sessions: response.data });
    };

    const loadBatches = async (): Promise<void> => {
      const response = await firstValueFrom(api.listWashBatches());
      patchState(store, { batches: response.data });
    };

    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        await Promise.all([loadSessions(), loadBatches()]);
        patchState(store, { loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const writeBatch = async (call: () => Promise<unknown>): Promise<IlrOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return ILR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        const [lookups, cages] = await Promise.all([
          firstValueFrom(api.getLookups()).catch(() => null),
          firstValueFrom(api.listRollCages()).catch(() => null),
        ]);
        patchState(store, {
          customers: lookups?.data.customers ?? [],
          programs: lookups?.data.programs ?? [],
          cages: cages?.data ?? [],
        });
        await load();
      },
      /** Submits a roll cage read at a gate: what the reader middleware does, from the console. */
      async scan(payload: IlrScanPayload): Promise<ScanOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.submitScan(payload));
          patchState(store, { saving: false, lastScan: response.data });
          await load();
          return { ...ILR_OK, session: response.data };
        } catch (error) {
          patchState(store, { saving: false });
          return { ...failureOf(error), session: null };
        }
      },
      createBatch(payload: IlrBatchPayload): Promise<IlrOutcome> {
        return writeBatch(() => firstValueFrom(api.createWashBatch(payload)));
      },
      certify(batchId: string, payload: IlrCertifyPayload): Promise<IlrOutcome> {
        return writeBatch(() => firstValueFrom(api.certifyWashBatch(batchId, payload)));
      },
      clearScan(): void {
        patchState(store, { lastScan: null });
      },
    };
  }),
);
