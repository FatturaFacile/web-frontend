import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  BondedWarehousesApiService,
  BwAeoAudit,
  BwAeoDashboard,
  BwAuditFilters,
  BwAuthorization,
  BwAuthorizationPayload,
  BwCguLedgerEntry,
  BwDischargePayload,
  BwDischargePlan,
  BwExportDataset,
  BwExportFormat,
  BwExtractionPreview,
  BwInboundMrnPayload,
  BwMrnLot,
  BwMrnLotFilters,
  BwOverview,
  BwPageMeta,
  BwReconciliationPayload,
  BwReconciliationResult,
  BwVatExtractionPayload,
  BwVatFilters,
  BwVatInboundPayload,
  BwVatRegisterEntry,
  InventoryApiService,
  WarehouseItem,
} from '@core';
import { downloadBlob } from '@shared';
import { BW_OK, BwOutcome, failureOf } from './bonded-warehouses.util';

/** Runs a write: the outcome carries the translated refusal instead of throwing into the template. */
async function attempt(work: () => Promise<unknown>): Promise<BwOutcome> {
  try {
    await work();
    return BW_OK;
  } catch (error) {
    return failureOf(error);
  }
}

export interface BwLookupState {
  authorizations: BwAuthorization[];
  warehouses: WarehouseItem[];
  loaded: boolean;
}

/** Authorizations and warehouses of the selects, loaded once for all the screens and refreshed after a change. */
export const BondedLookupStore = signalStore(
  { providedIn: 'root' },
  withState<BwLookupState>({ authorizations: [], warehouses: [], loaded: false }),
  withMethods(
    (store, api = inject(BondedWarehousesApiService), inventory = inject(InventoryApiService)) => ({
      load: async (force = false): Promise<void> => {
        if (store.loaded() && !force) {
          return;
        }
        try {
          const [authorizations, warehouses] = await Promise.all([
            firstValueFrom(api.listAuthorizations({ per_page: 100 })),
            firstValueFrom(inventory.getWarehouses()),
          ]);
          patchState(store, {
            authorizations: authorizations.data,
            warehouses: warehouses.data,
            loaded: true,
          });
        } catch {
          patchState(store, { authorizations: [], warehouses: [], loaded: false });
        }
      },
    }),
  ),
);

export interface BwDashboardState {
  overview: BwOverview | null;
  ledger: BwCguLedgerEntry[];
  ledgerMeta: BwPageMeta | null;
  loading: boolean;
  error: string | null;
}

export const BondedDashboardStore = signalStore(
  withState<BwDashboardState>({
    overview: null,
    ledger: [],
    ledgerMeta: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(BondedWarehousesApiService)) => ({
    load: async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        patchState(store, {
          overview: (await firstValueFrom(api.getOverview())).data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    loadLedger: async (authorizationId: string | null, page = 1): Promise<void> => {
      try {
        const result = await firstValueFrom(
          api.listCguLedger({ authorization_id: authorizationId, page, per_page: 15 }),
        );
        patchState(store, { ledger: result.data, ledgerMeta: result.meta ?? null });
      } catch (error) {
        patchState(store, { ledger: [], ledgerMeta: null, error: failureOf(error).errorKey });
      }
    },
  })),
);

export interface BwMrnState {
  lots: BwMrnLot[];
  meta: BwPageMeta | null;
  detail: BwMrnLot | null;
  plan: BwDischargePlan | null;
  loading: boolean;
  error: string | null;
}

export const BondedMrnStore = signalStore(
  withState<BwMrnState>({
    lots: [],
    meta: null,
    detail: null,
    plan: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(BondedWarehousesApiService)) => ({
    load: async (filters: BwMrnLotFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.listMrnLots(filters));
        patchState(store, { lots: page.data, meta: page.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    open: async (id: string): Promise<void> => {
      try {
        patchState(store, { detail: (await firstValueFrom(api.getMrnLot(id))).data });
      } catch (error) {
        patchState(store, { detail: null, error: failureOf(error).errorKey });
      }
    },
    closeDetail: (): void => patchState(store, { detail: null }),
    clearPlan: (): void => patchState(store, { plan: null }),
    registerInbound: (payload: BwInboundMrnPayload): Promise<BwOutcome> =>
      attempt(() => firstValueFrom(api.registerInboundMrn(payload))),
    simulate: async (payload: BwDischargePayload): Promise<BwOutcome> => {
      try {
        patchState(store, { plan: (await firstValueFrom(api.simulateDischarge(payload))).data });
        return BW_OK;
      } catch (error) {
        patchState(store, { plan: null });
        return failureOf(error);
      }
    },
    execute: async (payload: BwDischargePayload): Promise<BwOutcome> => {
      try {
        patchState(store, { plan: (await firstValueFrom(api.executeDischarge(payload))).data });
        return BW_OK;
      } catch (error) {
        return failureOf(error);
      }
    },
    exportFile: (
      dataset: BwExportDataset,
      format: BwExportFormat,
      filters: object,
    ): Promise<BwOutcome> =>
      attempt(async () =>
        downloadBlob(
          await firstValueFrom(api.exportDataset(dataset, format, filters)),
          `${dataset}.${format}`,
        ),
      ),
  })),
);

export interface BwVatState {
  entries: BwVatRegisterEntry[];
  meta: BwPageMeta | null;
  preview: BwExtractionPreview | null;
  loading: boolean;
  error: string | null;
}

export const BondedVatStore = signalStore(
  withState<BwVatState>({ entries: [], meta: null, preview: null, loading: false, error: null }),
  withMethods((store, api = inject(BondedWarehousesApiService)) => ({
    load: async (filters: BwVatFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.listVatRegister(filters));
        patchState(store, { entries: page.data, meta: page.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    clearPreview: (): void => patchState(store, { preview: null }),
    registerInbound: (payload: BwVatInboundPayload): Promise<BwOutcome> =>
      attempt(() => firstValueFrom(api.registerVatInbound(payload))),
    previewExtraction: async (payload: BwVatExtractionPayload): Promise<BwOutcome> => {
      try {
        patchState(store, {
          preview: (await firstValueFrom(api.previewVatExtraction(payload))).data,
        });
        return BW_OK;
      } catch (error) {
        patchState(store, { preview: null });
        return failureOf(error);
      }
    },
    extract: (payload: BwVatExtractionPayload): Promise<BwOutcome> =>
      attempt(() => firstValueFrom(api.executeVatExtraction(payload))),
    exportFile: (format: BwExportFormat, filters: object): Promise<BwOutcome> =>
      attempt(async () =>
        downloadBlob(
          await firstValueFrom(api.exportDataset('vat-register', format, filters)),
          `vat-register.${format}`,
        ),
      ),
  })),
);

export interface BwAeoState {
  dashboard: BwAeoDashboard | null;
  audits: BwAeoAudit[];
  meta: BwPageMeta | null;
  result: BwReconciliationResult | null;
  loading: boolean;
  error: string | null;
}

export const BondedAeoStore = signalStore(
  withState<BwAeoState>({
    dashboard: null,
    audits: [],
    meta: null,
    result: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(BondedWarehousesApiService)) => ({
    load: async (filters: BwAuditFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [dashboard, audits] = await Promise.all([
          firstValueFrom(api.getAeoDashboard()),
          firstValueFrom(api.listAeoAudits(filters)),
        ]);
        patchState(store, {
          dashboard: dashboard.data,
          audits: audits.data,
          meta: audits.meta ?? null,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    reconcile: async (payload: BwReconciliationPayload): Promise<BwOutcome> => {
      try {
        patchState(store, { result: (await firstValueFrom(api.runReconciliation(payload))).data });
        return BW_OK;
      } catch (error) {
        return failureOf(error);
      }
    },
    exportFile: (format: BwExportFormat, filters: object): Promise<BwOutcome> =>
      attempt(async () =>
        downloadBlob(
          await firstValueFrom(api.exportDataset('aeo-audits', format, filters)),
          `aeo-audits.${format}`,
        ),
      ),
  })),
);

export interface BwAuthorizationState {
  items: BwAuthorization[];
  loading: boolean;
  error: string | null;
}

export const BondedAuthorizationStore = signalStore(
  withState<BwAuthorizationState>({ items: [], loading: false, error: null }),
  withMethods((store, api = inject(BondedWarehousesApiService)) => ({
    load: async (
      filters: { regime_type?: string | null; is_active?: boolean | null; search?: string } = {},
    ): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        patchState(store, {
          items: (await firstValueFrom(api.listAuthorizations({ ...filters, per_page: 100 }))).data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    save: (payload: BwAuthorizationPayload, id: string | null): Promise<BwOutcome> =>
      attempt(() => firstValueFrom(api.saveAuthorization(payload, id))),
    remove: (id: string): Promise<BwOutcome> =>
      attempt(() => firstValueFrom(api.deleteAuthorization(id))),
  })),
);
