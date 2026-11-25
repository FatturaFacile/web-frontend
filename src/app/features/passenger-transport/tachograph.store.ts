import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  PassengerTransportApiService,
  PtrDddArchive,
  PtrDriver,
  PtrDriverPayload,
  PtrInfringement,
  PtrPersonRef,
  PtrVehicle,
} from '@core';
import { expiryState, failureOf, PTR_OK, PtrOutcome } from './passenger-transport.util';

export interface TachographState {
  drivers: PtrDriver[];
  archives: PtrDddArchive[];
  infringements: PtrInfringement[];
  vehicles: PtrVehicle[];
  employees: PtrPersonRef[];
  /** Driver the archive and the infringements are limited to; null shows all. */
  driverFilter: string | null;
  loading: boolean;
  uploading: boolean;
  saving: boolean;
  error: string | null;
}

/** The compliance records of the drivers (licence, CQC Persone, CZV, tachograph card) and the archive of the .DDD files. */
export const TachographStore = signalStore(
  withState<TachographState>({
    drivers: [],
    archives: [],
    infringements: [],
    vehicles: [],
    employees: [],
    driverFilter: null,
    loading: false,
    uploading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ drivers, infringements }) => ({
    /** Documents that are expired or about to expire, over all the drivers. */
    expiringDocuments: computed(() => {
      let count = 0;
      for (const driver of drivers()) {
        for (const date of [
          driver.driving_license_expiry_date,
          driver.cqc_persone_expiry_date,
          driver.czv_expiry_date,
          driver.tachograph_card_expiry_date,
        ]) {
          const state = expiryState(date);
          count += state === 'expired' || state === 'expiring' ? 1 : 0;
        }
      }
      return count;
    }),
    driverName: computed(() => {
      const names = new Map(
        drivers().map((driver) => [driver.driver_employee_id, driver.driver_name ?? '']),
      );
      return (id: string | null): string => (id ? (names.get(id) ?? '') : '');
    }),
    infringementCount: computed(() => infringements().length),
  })),
  withMethods((store, api = inject(PassengerTransportApiService)) => {
    const loadArchives = async (): Promise<void> => {
      const driverId = store.driverFilter() ?? undefined;
      const [archives, infringements] = await Promise.all([
        firstValueFrom(api.listDddArchives(driverId)),
        firstValueFrom(api.listInfringements(driverId)),
      ]);
      patchState(store, { archives: archives.data, infringements: infringements.data });
    };

    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [drivers, vehicles] = await Promise.all([
          firstValueFrom(api.listDrivers()),
          firstValueFrom(api.listVehicles()),
        ]);
        patchState(store, { drivers: drivers.data, vehicles: vehicles.data });
        await loadArchives();
        patchState(store, { loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    return {
      load,
      async setDriverFilter(id: string | null): Promise<void> {
        patchState(store, { driverFilter: id });
        await loadArchives().catch((error: unknown) =>
          patchState(store, { error: failureOf(error).errorKey }),
        );
      },
      async searchEmployees(q: string): Promise<void> {
        const response = await firstValueFrom(api.searchDrivers(q)).catch(() => null);
        patchState(store, { employees: response?.data ?? [] });
      },
      async saveDriver(payload: PtrDriverPayload, id?: string): Promise<PtrOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(id ? api.updateDriver(id, payload) : api.createDriver(payload));
          patchState(store, { saving: false });
          await load();
          return PTR_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async upload(file: File, driverId?: string, vehicleId?: string): Promise<PtrOutcome> {
        patchState(store, { uploading: true });
        try {
          await firstValueFrom(api.uploadDdd(file, driverId, vehicleId));
          patchState(store, { uploading: false });
          await load();
          return PTR_OK;
        } catch (error) {
          patchState(store, { uploading: false });
          return failureOf(error);
        }
      },
      download: (id: string) => firstValueFrom(api.downloadDdd(id)),
    };
  }),
);
