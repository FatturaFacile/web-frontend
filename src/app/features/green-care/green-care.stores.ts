import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CrmApiService,
  GcBillingRequest,
  GcBillingResult,
  GcContract,
  GcContractFilters,
  GcContractPayload,
  GcCrew,
  GcDashboard,
  GcInterventionPayload,
  GcLicense,
  GcLicenseCheck,
  GcLicensePayload,
  GcOptimizeRequest,
  GcOptimizeResult,
  GcPageMeta,
  GcReference,
  GcRescheduleResult,
  GcRoute,
  GcRouteFilters,
  GcSite,
  GcSiteFilters,
  GcSitePayload,
  GcStop,
  GcTreatment,
  GcTreatmentFilters,
  GcTreatmentPayload,
  GcWasteFilters,
  GcWasteSlip,
  GcWasteSlipPayload,
  GcWasteSummary,
  GreenCareApiService,
  InventoryApiService,
  ProductItem,
  WarehouseItem,
} from '@core';
import { GC_OK, GcOutcome, contactName, failureOf } from './green-care.util';

/** Runs a write: the outcome carries the translated refusal instead of throwing into the template. */
async function attempt(work: () => Promise<unknown>): Promise<GcOutcome> {
  try {
    await work();
    return GC_OK;
  } catch (error) {
    return failureOf(error);
  }
}

export interface GcReferenceState {
  reference: GcReference | null;
  loaded: boolean;
}

/** Codes of the selects (enums, licence types per jurisdiction, waste codes): loaded once for all the screens. */
export const GreenCareReferenceStore = signalStore(
  { providedIn: 'root' },
  withState<GcReferenceState>({ reference: null, loaded: false }),
  withMethods((store, api = inject(GreenCareApiService)) => ({
    load: async (): Promise<void> => {
      if (store.loaded()) {
        return;
      }
      try {
        patchState(store, { reference: (await firstValueFrom(api.getReference())).data, loaded: true });
      } catch {
        patchState(store, { reference: null, loaded: false });
      }
    },
  })),
);

export interface GcLookupOption {
  id: string;
  label: string;
}

export interface GcLookupState {
  customers: GcLookupOption[];
  products: (GcLookupOption & { unit: string })[];
  warehouses: GcLookupOption[];
  sites: GcLookupOption[];
  suppliers: GcLookupOption[];
}

/** Selectors fed by the existing contacts, products and warehouses endpoints and by the sites of the module. */
export const GreenCareLookupStore = signalStore(
  { providedIn: 'root' },
  withState<GcLookupState>({ customers: [], products: [], warehouses: [], sites: [], suppliers: [] }),
  withMethods((store, crm = inject(CrmApiService), inventory = inject(InventoryApiService), api = inject(GreenCareApiService)) => ({
    searchCustomers: async (search = ''): Promise<void> => {
      try {
        const page = await firstValueFrom(crm.getContacts({ search, per_page: 50 }));
        patchState(store, {
          customers: page.data
            .filter((contact) => contact.type !== 'supplier')
            .map((contact) => ({ id: contact.id, label: contactName(contact) })),
        });
      } catch {
        patchState(store, { customers: [] });
      }
    },
    searchSuppliers: async (search = ''): Promise<void> => {
      try {
        const page = await firstValueFrom(crm.getContacts({ search, per_page: 50, type: 'supplier' }));
        patchState(store, { suppliers: page.data.map((contact) => ({ id: contact.id, label: contactName(contact) })) });
      } catch {
        patchState(store, { suppliers: [] });
      }
    },
    searchProducts: async (search = ''): Promise<void> => {
      try {
        const page = await firstValueFrom(inventory.getProducts({ search, per_page: 50 }));
        patchState(store, {
          products: page.data.map((product: ProductItem) => ({
            id: product.id,
            label: `${product.sku} · ${product.name}`,
            unit: product.unit_measure,
          })),
        });
      } catch {
        patchState(store, { products: [] });
      }
    },
    loadWarehouses: async (): Promise<void> => {
      if (store.warehouses().length > 0) {
        return;
      }
      try {
        const answer = await firstValueFrom(inventory.getWarehouses({ is_active: true }));
        patchState(store, {
          warehouses: answer.data.map((warehouse: WarehouseItem) => ({ id: warehouse.id, label: `${warehouse.code} · ${warehouse.name}` })),
        });
      } catch {
        patchState(store, { warehouses: [] });
      }
    },
    loadSites: async (): Promise<void> => {
      try {
        const page = await firstValueFrom(api.listSites({ is_active: true, per_page: 100 }));
        patchState(store, { sites: page.data.map((site) => ({ id: site.id, label: `${site.code} · ${site.name}` })) });
      } catch {
        patchState(store, { sites: [] });
      }
    },
  })),
);

export interface GcCrewState {
  crews: GcCrew[];
  loaded: boolean;
}

/** Crews with their members and licences: the operator selectors of the planner and of the diary. */
export const GreenCareCrewStore = signalStore(
  { providedIn: 'root' },
  withState<GcCrewState>({ crews: [], loaded: false }),
  withMethods((store, api = inject(GreenCareApiService)) => ({
    load: async (force = false): Promise<void> => {
      if (store.loaded() && !force) {
        return;
      }
      try {
        patchState(store, { crews: (await firstValueFrom(api.listCrews())).data, loaded: true });
      } catch {
        patchState(store, { crews: [], loaded: false });
      }
    },
    saveCrew: (id: string | null, payload: Partial<GcCrew>): Promise<GcOutcome> =>
      attempt(async () => {
        await firstValueFrom(id === null ? api.createCrew(payload) : api.updateCrew(id, payload));
        patchState(store, { crews: (await firstValueFrom(api.listCrews())).data, loaded: true });
      }),
    removeCrew: (id: string): Promise<GcOutcome> =>
      attempt(async () => {
        await firstValueFrom(api.deleteCrew(id));
        patchState(store, { crews: store.crews().filter((crew) => crew.id !== id) });
      }),
    saveLicense: (id: string | null, payload: GcLicensePayload): Promise<GcOutcome> =>
      attempt(async () => {
        await firstValueFrom(id === null ? api.createLicense(payload) : api.updateLicense(id, payload));
        patchState(store, { crews: (await firstValueFrom(api.listCrews())).data, loaded: true });
      }),
    removeLicense: (id: string): Promise<GcOutcome> =>
      attempt(async () => {
        await firstValueFrom(api.deleteLicense(id));
        patchState(store, { crews: (await firstValueFrom(api.listCrews())).data, loaded: true });
      }),
  })),
);

export interface GcDashboardState {
  dashboard: GcDashboard | null;
  loading: boolean;
  error: string | null;
}

/** KPI cards of the green care dashboard. */
export const GreenCareDashboardStore = signalStore(
  withState<GcDashboardState>({ dashboard: null, loading: false, error: null }),
  withMethods((store, api = inject(GreenCareApiService)) => ({
    load: async (year?: number | null): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        patchState(store, { dashboard: (await firstValueFrom(api.getDashboard(year))).data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
  })),
);

export interface GcSitesState {
  sites: GcSite[];
  meta: GcPageMeta | null;
  selected: GcSite | null;
  loading: boolean;
  error: string | null;
}

/** Green space sites: master-detail CRUD. */
export const GreenCareSitesStore = signalStore(
  withState<GcSitesState>({ sites: [], meta: null, selected: null, loading: false, error: null }),
  withMethods((store, api = inject(GreenCareApiService)) => ({
    load: async (filters: GcSiteFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.listSites(filters));
        const selected = store.selected();
        patchState(store, {
          sites: page.data,
          meta: page.meta ?? null,
          selected: selected === null ? null : (page.data.find((site) => site.id === selected.id) ?? selected),
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    select: (site: GcSite | null): void => patchState(store, { selected: site }),
    save: (id: string | null, payload: GcSitePayload): Promise<GcOutcome> =>
      attempt(async () => {
        const saved = (await firstValueFrom(id === null ? api.createSite(payload) : api.updateSite(id, payload))).data;
        patchState(store, { selected: saved });
      }),
    remove: (id: string): Promise<GcOutcome> =>
      attempt(async () => {
        await firstValueFrom(api.deleteSite(id));
        patchState(store, { selected: null, sites: store.sites().filter((site) => site.id !== id) });
      }),
  })),
);

export interface GcContractsState {
  contracts: GcContract[];
  meta: GcPageMeta | null;
  billing: GcBillingResult | null;
  billingBusy: boolean;
  loading: boolean;
  error: string | null;
}

/** Seasonal contracts: list, lifecycle, billing preview and invoice generation. */
export const GreenCareContractsStore = signalStore(
  withState<GcContractsState>({ contracts: [], meta: null, billing: null, billingBusy: false, loading: false, error: null }),
  withMethods((store, api = inject(GreenCareApiService)) => {
    const replace = (contract: GcContract): void =>
      patchState(store, { contracts: store.contracts().map((item) => (item.id === contract.id ? contract : item)) });

    return {
      load: async (filters: GcContractFilters = {}): Promise<void> => {
        patchState(store, { loading: true, error: null });
        try {
          const page = await firstValueFrom(api.listContracts(filters));
          patchState(store, { contracts: page.data, meta: page.meta ?? null, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      save: (id: string | null, payload: GcContractPayload): Promise<GcOutcome> =>
        attempt(() => firstValueFrom(id === null ? api.createContract(payload) : api.updateContract(id, payload))),
      remove: (id: string): Promise<GcOutcome> =>
        attempt(async () => {
          await firstValueFrom(api.deleteContract(id));
          patchState(store, { contracts: store.contracts().filter((contract) => contract.id !== id) });
        }),
      activate: (id: string): Promise<GcOutcome> =>
        attempt(async () => replace((await firstValueFrom(api.activateContract(id))).data)),
      suspend: (id: string): Promise<GcOutcome> =>
        attempt(async () => replace((await firstValueFrom(api.suspendContract(id))).data)),
      clearBilling: (): void => patchState(store, { billing: null }),
      previewBilling: async (id: string, request: GcBillingRequest): Promise<GcOutcome> => {
        patchState(store, { billingBusy: true, billing: null });
        const outcome = await attempt(async () =>
          patchState(store, { billing: (await firstValueFrom(api.previewBilling(id, request))).data }),
        );
        patchState(store, { billingBusy: false });
        return outcome;
      },
      generateInvoice: async (id: string, request: GcBillingRequest): Promise<GcOutcome> => {
        patchState(store, { billingBusy: true });
        const outcome = await attempt(async () => {
          patchState(store, { billing: (await firstValueFrom(api.generateInvoice(id, request))).data });
          replace((await firstValueFrom(api.getContract(id))).data);
        });
        patchState(store, { billingBusy: false });
        return outcome;
      },
    };
  }),
);

export interface GcPlannerState {
  routes: GcRoute[];
  optimizing: boolean;
  rescheduling: boolean;
  lastOptimize: GcOptimizeResult | null;
  lastReschedule: GcRescheduleResult | null;
  loading: boolean;
  error: string | null;
}

/** Weekly multi-crew route board: optimisation, weather rescheduling and the intervention log of each stop. */
export const GreenCarePlannerStore = signalStore(
  withState<GcPlannerState>({
    routes: [],
    optimizing: false,
    rescheduling: false,
    lastOptimize: null,
    lastReschedule: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(GreenCareApiService)) => {
    const mergeRoutes = (updated: GcRoute[]): void => {
      const byId = new Map(updated.map((route) => [route.id, route]));
      patchState(store, { routes: store.routes().map((route) => byId.get(route.id) ?? route) });
    };
    const replaceStop = (stop: GcStop): void =>
      patchState(store, {
        routes: store.routes().map((route) =>
          route.id === stop.route_schedule_id
            ? { ...route, stops: route.stops.map((item) => (item.id === stop.id ? stop : item)) }
            : route,
        ),
      });

    return {
      load: async (filters: GcRouteFilters = {}): Promise<void> => {
        patchState(store, { loading: true, error: null });
        try {
          patchState(store, { routes: (await firstValueFrom(api.listRoutes(filters))).data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      optimize: async (request: GcOptimizeRequest): Promise<GcOutcome> => {
        patchState(store, { optimizing: true, lastOptimize: null });
        const outcome = await attempt(async () =>
          patchState(store, { lastOptimize: (await firstValueFrom(api.optimizeRoutes(request))).data }),
        );
        patchState(store, { optimizing: false });
        return outcome;
      },
      reschedule: async (range: { from: string; to: string }): Promise<GcOutcome> => {
        patchState(store, { rescheduling: true, lastReschedule: null });
        const outcome = await attempt(async () => {
          const result = (await firstValueFrom(api.rescheduleForWeather(range))).data;
          patchState(store, { lastReschedule: result });
          mergeRoutes(result.routes);
        });
        patchState(store, { rescheduling: false });
        return outcome;
      },
      refreshWeather: (id: string): Promise<GcOutcome> =>
        attempt(async () => mergeRoutes([(await firstValueFrom(api.refreshWeather(id))).data])),
      reorder: (route: GcRoute, order: string[]): Promise<GcOutcome> =>
        attempt(async () => mergeRoutes([(await firstValueFrom(api.updateRoute(route.id, { stop_order: order }))).data])),
      removeRoute: (id: string): Promise<GcOutcome> =>
        attempt(async () => {
          await firstValueFrom(api.deleteRoute(id));
          patchState(store, { routes: store.routes().filter((route) => route.id !== id) });
        }),
      logIntervention: (stopId: string, payload: GcInterventionPayload): Promise<GcOutcome> =>
        attempt(async () => replaceStop((await firstValueFrom(api.logIntervention(stopId, payload))).data)),
      uploadPhotos: (stopId: string, type: 'before' | 'after', files: File[]): Promise<GcOutcome> =>
        attempt(async () => replaceStop((await firstValueFrom(api.uploadPhotos(stopId, type, files))).data)),
    };
  }),
);

export interface GcTreatmentsState {
  treatments: GcTreatment[];
  meta: GcPageMeta | null;
  licenseCheck: GcLicenseCheck | null;
  licenses: GcLicense[];
  loading: boolean;
  exporting: boolean;
  error: string | null;
}

/** Phytosanitary diary: the immutable log, the live licence check of the operator and the inspection PDF. */
export const GreenCareTreatmentsStore = signalStore(
  withState<GcTreatmentsState>({
    treatments: [],
    meta: null,
    licenseCheck: null,
    licenses: [],
    loading: false,
    exporting: false,
    error: null,
  }),
  withMethods((store, api = inject(GreenCareApiService)) => ({
    load: async (filters: GcTreatmentFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.listTreatments(filters));
        patchState(store, { treatments: page.data, meta: page.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    loadLicenses: async (): Promise<void> => {
      try {
        patchState(store, { licenses: (await firstValueFrom(api.listLicenses())).data });
      } catch {
        patchState(store, { licenses: [] });
      }
    },
    checkLicense: async (operatorId: string, treatmentDate: string, siteId: string | null): Promise<void> => {
      try {
        patchState(store, {
          licenseCheck: (await firstValueFrom(api.validateLicense({ operator_id: operatorId, treatment_date: treatmentDate, site_id: siteId }))).data,
        });
      } catch {
        patchState(store, { licenseCheck: null });
      }
    },
    clearLicenseCheck: (): void => patchState(store, { licenseCheck: null }),
    create: (payload: GcTreatmentPayload): Promise<GcOutcome> => attempt(() => firstValueFrom(api.createTreatment(payload))),
    exportPdf: async (filters: GcTreatmentFilters): Promise<Blob | null> => {
      patchState(store, { exporting: true });
      try {
        return await firstValueFrom(api.exportTreatmentsPdf(filters));
      } catch {
        return null;
      } finally {
        patchState(store, { exporting: false });
      }
    },
  })),
);

export interface GcWasteState {
  slips: GcWasteSlip[];
  meta: GcPageMeta | null;
  summary: GcWasteSummary | null;
  loading: boolean;
  error: string | null;
}

/** Green waste disposal slips (CER / OTR) with the weight summary. */
export const GreenCareWasteStore = signalStore(
  withState<GcWasteState>({ slips: [], meta: null, summary: null, loading: false, error: null }),
  withMethods((store, api = inject(GreenCareApiService)) => ({
    load: async (filters: GcWasteFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [page, summary] = await Promise.all([
          firstValueFrom(api.listSlips(filters)),
          firstValueFrom(api.getSlipSummary({ from: filters.from, to: filters.to })),
        ]);
        patchState(store, { slips: page.data, meta: page.meta ?? null, summary: summary.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    save: (id: string | null, payload: GcWasteSlipPayload): Promise<GcOutcome> =>
      attempt(() => firstValueFrom(id === null ? api.createSlip(payload) : api.updateSlip(id, payload))),
    remove: (id: string): Promise<GcOutcome> => attempt(() => firstValueFrom(api.deleteSlip(id))),
  })),
);
