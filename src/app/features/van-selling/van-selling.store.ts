import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CustomerFieldDossier,
  FieldRoutePlan,
  Gs1ParseResult,
  OfflineSyncBatchResult,
  ReplenishmentSuggestion,
  ThermalPrintJob,
  VanEodSettlement,
  VanEodSettlementPreview,
  VanLoadManifest,
  VanSectionalBatchReservation,
  VanSellingApiService,
  VanSellingConfig,
  VanVisitOutcome,
  VanVisitOutcomeCreatePayload,
  VanWarehouse,
  VanWarehouseCreatePayload,
} from '@core';

export interface VanSellingState {
  config: VanSellingConfig | null;
  vans: VanWarehouse[];
  selectedVanId: string | null;
  manifests: VanLoadManifest[];
  suggestions: ReplenishmentSuggestion[];
  routePlans: FieldRoutePlan[];
  selectedRouteId: string | null;
  selectedCustomerId: string | null;
  customerDossier: CustomerFieldDossier | null;
  lastGs1Parse: Gs1ParseResult | null;
  visits: VanVisitOutcome[];
  offlineQueue: VanVisitOutcomeCreatePayload[];
  lastSyncResult: OfflineSyncBatchResult | null;
  lastReservedBatch: VanSectionalBatchReservation | null;
  activePrintJob: ThermalPrintJob | null;
  settlementPreview: VanEodSettlementPreview | null;
  settlements: VanEodSettlement[];
  loading: boolean;
  error: string | null;
}

/**
 * CQRS-style SignalStore for Mod 233 (Van Selling & Offline Field Sales).
 * Consumes all UI labels and domain copy from the API-seeded `/van-selling/config` endpoint.
 */
export const VanSellingStore = signalStore(
  withState<VanSellingState>({
    config: null,
    vans: [],
    selectedVanId: null,
    manifests: [],
    suggestions: [],
    routePlans: [],
    selectedRouteId: null,
    selectedCustomerId: null,
    customerDossier: null,
    lastGs1Parse: null,
    visits: [],
    offlineQueue: [],
    lastSyncResult: null,
    lastReservedBatch: null,
    activePrintJob: null,
    settlementPreview: null,
    settlements: [],
    loading: false,
    error: null,
  }),
  withComputed(({ config, vans, selectedVanId, routePlans, selectedRouteId }) => ({
    copy: computed(() => config()?.ui_copy ?? {}),
    selectedVan: computed(() => vans().find((v) => v.id === selectedVanId()) ?? vans()[0] ?? null),
    selectedRoute: computed(() => routePlans().find((r) => r.id === selectedRouteId()) ?? routePlans()[0] ?? null),
  })),
  withMethods((store, api = inject(VanSellingApiService)) => ({
    label(key: string): string {
      return store.copy()[key] ?? key;
    },

    async loadAll(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const [cfgRes, vansRes, manifestsRes, routesRes, visitsRes, settlementsRes] = await Promise.all([
          firstValueFrom(api.getConfig()),
          firstValueFrom(api.getVans()),
          firstValueFrom(api.getLoadManifests()),
          firstValueFrom(api.getRoutePlans()),
          firstValueFrom(api.getVisits()),
          firstValueFrom(api.getSettlements()),
        ]);
        const vans = vansRes.data;
        const routes = routesRes.data;
        patchState(store, {
          config: cfgRes.data,
          vans,
          selectedVanId: store.selectedVanId() ?? vans[0]?.id ?? null,
          manifests: manifestsRes.data,
          routePlans: routes,
          selectedRouteId: store.selectedRouteId() ?? routes[0]?.id ?? null,
          visits: visitsRes.data,
          settlements: settlementsRes.data,
          loading: false,
        });
      } catch (err: unknown) {
        patchState(store, { loading: false, error: err instanceof Error ? err.message : 'Request failed' });
      }
    },

    selectVan(vanId: string): void {
      patchState(store, { selectedVanId: vanId });
    },

    selectRoute(routeId: string): void {
      patchState(store, { selectedRouteId: routeId });
    },

    async createVan(payload: VanWarehouseCreatePayload): Promise<VanWarehouse | null> {
      const res = await firstValueFrom(api.createVan(payload));
      patchState(store, { vans: [res.data, ...store.vans()], selectedVanId: res.data.id });
      return res.data;
    },

    async recordTemperature(vanId: string, tempCelsius: number, notes?: string): Promise<void> {
      const res = await firstValueFrom(api.recordTemperature(vanId, tempCelsius, notes));
      patchState(store, {
        vans: store.vans().map((v) => (v.id === vanId ? res.data : v)),
      });
    },

    async reserveSectionalBatch(vanId: string, documentType: string, count = 25): Promise<VanSectionalBatchReservation> {
      const res = await firstValueFrom(api.reserveSectionalBatch(vanId, documentType, count));
      patchState(store, { lastReservedBatch: res.data });
      return res.data;
    },

    async loadReplenishmentSuggestions(vanId: string, weekdayIso?: number, routeCode?: string): Promise<void> {
      const res = await firstValueFrom(api.getReplenishmentSuggestions(vanId, weekdayIso, routeCode));
      patchState(store, { suggestions: res.data });
    },

    async createManifest(payload: Parameters<VanSellingApiService['createLoadManifest']>[0]): Promise<VanLoadManifest> {
      const res = await firstValueFrom(api.createLoadManifest(payload));
      patchState(store, { manifests: [res.data, ...store.manifests()] });
      return res.data;
    },

    async issueGlobalDdt(manifestId: string): Promise<VanLoadManifest> {
      const res = await firstValueFrom(api.issueGlobalDdt(manifestId));
      patchState(store, {
        manifests: store.manifests().map((m) => (m.id === manifestId ? res.data : m)),
      });
      return res.data;
    },

    async loadCustomerDossier(contactId: string, proposedAmount = 0): Promise<CustomerFieldDossier> {
      const res = await firstValueFrom(api.getCustomerFieldDossier(contactId, proposedAmount));
      patchState(store, { selectedCustomerId: contactId, customerDossier: res.data });
      return res.data;
    },

    async unblockCustomerCredit(
      contactId: string,
      payload: { invoice_id: string; amount: number; payment_method: string; reference?: string },
    ): Promise<boolean> {
      const res = await firstValueFrom(api.unblockCustomerCredit(contactId, payload));
      const dossier = store.customerDossier();
      if (dossier && dossier.contact.id === contactId) {
        patchState(store, { customerDossier: { ...dossier, credit: res.data.credit } });
      }
      return res.data.unblocked;
    },

    async parseGs1Barcode(barcode: string): Promise<Gs1ParseResult> {
      const res = await firstValueFrom(api.parseGs1Barcode(barcode));
      patchState(store, { lastGs1Parse: res.data });
      return res.data;
    },

    async submitVisit(payload: VanVisitOutcomeCreatePayload): Promise<VanVisitOutcome> {
      const res = await firstValueFrom(api.recordVisit(payload));
      patchState(store, { visits: [res.data, ...store.visits()] });
      return res.data;
    },

    queueOfflineVisit(payload: VanVisitOutcomeCreatePayload): void {
      patchState(store, { offlineQueue: [...store.offlineQueue(), payload] });
    },

    async runOfflineDeltaSync(vanId: string): Promise<OfflineSyncBatchResult> {
      const van = store.vans().find((v) => v.id === vanId);
      const res = await firstValueFrom(
        api.syncOfflineBatch({
          van_warehouse_id: vanId,
          client_sync_version: van?.sync_version ?? 0,
          visits: store.offlineQueue(),
        }),
      );
      patchState(store, { offlineQueue: [], lastSyncResult: res.data });
      const visitsRes = await firstValueFrom(api.getVisits(vanId));
      patchState(store, { visits: visitsRes.data });
      return res.data;
    },

    async fetchThermalPrint(visitId: string): Promise<ThermalPrintJob> {
      const res = await firstValueFrom(api.getThermalPrint(visitId));
      patchState(store, { activePrintJob: res.data });
      return res.data;
    },

    async previewSettlement(vanId: string, settlementDate?: string): Promise<VanEodSettlementPreview> {
      const res = await firstValueFrom(api.previewSettlement({ van_warehouse_id: vanId, settlement_date: settlementDate }));
      patchState(store, { settlementPreview: res.data });
      return res.data;
    },

    async completeSettlement(payload: Parameters<VanSellingApiService['completeSettlement']>[0]): Promise<VanEodSettlement> {
      const res = await firstValueFrom(api.completeSettlement(payload));
      patchState(store, {
        settlements: [res.data, ...store.settlements()],
        settlementPreview: null,
      });
      return res.data;
    },
  })),
);
