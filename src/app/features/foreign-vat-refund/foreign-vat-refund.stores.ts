import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ForeignVatRefundApiService,
  FvrClaim,
  FvrClaimPeriodPayload,
  FvrClaimPreview,
  FvrCreateClaimPayload,
  FvrDashboard,
  FvrDecidePayload,
  FvrExportType,
  FvrLedgerEntry,
  FvrLedgerFilters,
  FvrManualLedgerPayload,
  FvrMandate,
  FvrMandatePayload,
  FvrPageMeta,
  FvrReconcilePayload,
  FvrReference,
  FvrRule,
  FvrRulePayload,
  FvrRulesMeta,
  FvrSettings,
  FvrSubmitPayload,
} from '@core';
import { FVR_OK, FvrOutcome, failureOf } from './foreign-vat-refund.util';

/** Runs a write: the outcome carries the translated refusal instead of throwing into the template. */
async function attempt(work: () => Promise<unknown>): Promise<FvrOutcome> {
  try {
    await work();
    return FVR_OK;
  } catch (error) {
    return failureOf(error);
  }
}

export interface FvrReferenceState {
  reference: FvrReference | null;
  loaded: boolean;
}

/** Codes of the selects (home country, refund countries, categories, regimes): loaded once for all the screens. */
export const ForeignVatReferenceStore = signalStore(
  { providedIn: 'root' },
  withState<FvrReferenceState>({ reference: null, loaded: false }),
  withMethods((store, api = inject(ForeignVatRefundApiService)) => ({
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

export interface FvrDashboardState {
  dashboard: FvrDashboard | null;
  loading: boolean;
  error: string | null;
}

/** KPI cards and the threshold and deadline monitor. */
export const ForeignVatDashboardStore = signalStore(
  withState<FvrDashboardState>({ dashboard: null, loading: false, error: null }),
  withMethods((store, api = inject(ForeignVatRefundApiService)) => ({
    load: async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        patchState(store, { dashboard: (await firstValueFrom(api.getDashboard())).data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
  })),
);

export interface FvrLedgerState {
  entries: FvrLedgerEntry[];
  meta: FvrPageMeta | null;
  loading: boolean;
  error: string | null;
}

/** The filterable foreign VAT ledger. */
export const ForeignVatLedgerStore = signalStore(
  withState<FvrLedgerState>({ entries: [], meta: null, loading: false, error: null }),
  withMethods((store, api = inject(ForeignVatRefundApiService)) => ({
    load: async (filters: FvrLedgerFilters = {}): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.listLedger(filters));
        patchState(store, { entries: page.data, meta: page.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    create: (payload: FvrManualLedgerPayload): Promise<FvrOutcome> =>
      attempt(() => firstValueFrom(api.createLedgerEntry(payload))),
    changeCategory: (id: string, category: number): Promise<FvrOutcome> =>
      attempt(() => firstValueFrom(api.updateLedgerEntry(id, { expense_category_code: category }))),
    recalculate: (id: string): Promise<FvrOutcome> =>
      attempt(() => firstValueFrom(api.recalculateLedgerEntry(id))),
    remove: (id: string): Promise<FvrOutcome> => attempt(() => firstValueFrom(api.deleteLedgerEntry(id))),
    attach: (id: string, file: File): Promise<FvrOutcome> =>
      attempt(() => firstValueFrom(api.uploadLedgerAttachment(id, file))),
    preview: async (id: string): Promise<Blob | null> => {
      try {
        return await firstValueFrom(api.downloadLedgerAttachment(id));
      } catch {
        return null;
      }
    },
  })),
);

export interface FvrClaimsState {
  claims: FvrClaim[];
  meta: FvrPageMeta | null;
  selected: FvrClaim | null;
  preview: FvrClaimPreview | null;
  loading: boolean;
  previewing: boolean;
  error: string | null;
}

/** The claims (dossiers): list, wizard preview, detail and lifecycle. */
export const ForeignVatClaimsStore = signalStore(
  withState<FvrClaimsState>({
    claims: [],
    meta: null,
    selected: null,
    preview: null,
    loading: false,
    previewing: false,
    error: null,
  }),
  withMethods((store, api = inject(ForeignVatRefundApiService)) => {
    /** Runs a lifecycle call and keeps the detail drawer on the fresh claim. */
    const lifecycle = (call: () => Promise<{ data: FvrClaim }>): Promise<FvrOutcome> =>
      attempt(async () => {
        const answer = await call();
        patchState(store, {
          selected: answer.data,
          claims: store.claims().map((claim) => (claim.id === answer.data.id ? answer.data : claim)),
        });
      });

    return {
      load: async (
        filters: { status?: string | null; country?: string | null; fiscal_year?: number | null } = {},
      ): Promise<void> => {
        patchState(store, { loading: true, error: null });
        try {
          const page = await firstValueFrom(api.listClaims(filters));
          patchState(store, { claims: page.data, meta: page.meta ?? null, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      open: async (id: string): Promise<void> => {
        try {
          patchState(store, { selected: (await firstValueFrom(api.getClaim(id))).data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      close: (): void => patchState(store, { selected: null }),
      previewPeriod: async (payload: FvrClaimPeriodPayload): Promise<void> => {
        patchState(store, { previewing: true, preview: null });
        try {
          patchState(store, { preview: (await firstValueFrom(api.previewClaim(payload))).data, previewing: false });
        } catch (error) {
          patchState(store, { previewing: false, error: failureOf(error).errorKey });
        }
      },
      clearPreview: (): void => patchState(store, { preview: null }),
      create: (payload: FvrCreateClaimPayload): Promise<FvrOutcome> =>
        attempt(async () => {
          const created = (await firstValueFrom(api.createClaim(payload))).data;
          patchState(store, { selected: created, claims: [created, ...store.claims()] });
        }),
      remove: (id: string): Promise<FvrOutcome> =>
        attempt(async () => {
          await firstValueFrom(api.deleteClaim(id));
          patchState(store, { selected: null, claims: store.claims().filter((claim) => claim.id !== id) });
        }),
      ready: (id: string): Promise<FvrOutcome> => lifecycle(() => firstValueFrom(api.markReady(id))),
      draft: (id: string): Promise<FvrOutcome> => lifecycle(() => firstValueFrom(api.backToDraft(id))),
      submit: (id: string, payload: FvrSubmitPayload): Promise<FvrOutcome> =>
        lifecycle(() => firstValueFrom(api.submitClaim(id, payload))),
      requestInformation: (id: string, note: string): Promise<FvrOutcome> =>
        lifecycle(() => firstValueFrom(api.requestInformation(id, note))),
      decide: (id: string, payload: FvrDecidePayload): Promise<FvrOutcome> =>
        lifecycle(() => firstValueFrom(api.decideClaim(id, payload))),
      reconcile: (id: string, payload: FvrReconcilePayload): Promise<FvrOutcome> =>
        lifecycle(() => firstValueFrom(api.reconcileClaim(id, payload))),
      download: async (id: string, type: FvrExportType): Promise<{ blob: Blob | null; outcome: FvrOutcome }> => {
        try {
          return { blob: await firstValueFrom(api.downloadExport(id, type)), outcome: FVR_OK };
        } catch (error) {
          return { blob: null, outcome: await blobFailure(error) };
        }
      },
    };
  }),
);

/** A failed blob download carries its problem as a Blob: read it back as JSON. */
async function blobFailure(error: unknown): Promise<FvrOutcome> {
  const body: unknown = (error as { error?: unknown } | null)?.error;
  if (body instanceof Blob) {
    try {
      const problem = JSON.parse(await body.text()) as { code?: string; context?: Record<string, unknown> };
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(problem.context ?? {})) {
        params[key] = String(value ?? '');
      }
      return { ok: false, errorKey: `foreignVat.error.${problem.code ?? 'unknown'}`, code: problem.code ?? null, params };
    } catch {
      return failureOf(null);
    }
  }
  return failureOf(error);
}

export interface FvrConfigState {
  rules: FvrRule[];
  rulesMeta: FvrRulesMeta | null;
  mandates: FvrMandate[];
  settings: FvrSettings | null;
  loading: boolean;
  error: string | null;
}

/** The matrix of the countries, the fiscal representative mandates and the company settings. */
export const ForeignVatConfigStore = signalStore(
  withState<FvrConfigState>({
    rules: [],
    rulesMeta: null,
    mandates: [],
    settings: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(ForeignVatRefundApiService)) => ({
    loadRules: async (country?: string): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const answer = await firstValueFrom(api.listRules(country));
        patchState(store, { rules: answer.data, rulesMeta: answer.meta, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    saveRule: (payload: FvrRulePayload, id?: string): Promise<FvrOutcome> =>
      attempt(() => firstValueFrom(api.saveRule(payload, id))),
    revertRule: (id: string): Promise<FvrOutcome> => attempt(() => firstValueFrom(api.deleteRule(id))),
    loadMandates: async (): Promise<void> => {
      try {
        patchState(store, { mandates: (await firstValueFrom(api.listMandates())).data });
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
      }
    },
    saveMandate: (payload: FvrMandatePayload, id?: string): Promise<FvrOutcome> =>
      attempt(() => firstValueFrom(api.saveMandate(payload, id))),
    removeMandate: (id: string): Promise<FvrOutcome> =>
      attempt(() => firstValueFrom(api.deleteMandate(id))),
    uploadDocument: (
      id: string,
      type: 'power_of_attorney' | 'certificate',
      file: File,
      expiry?: string | null,
    ): Promise<FvrOutcome> => attempt(() => firstValueFrom(api.uploadMandateDocument(id, type, file, expiry))),
    downloadDocument: async (id: string, type: 'power_of_attorney' | 'certificate'): Promise<Blob | null> => {
      try {
        return await firstValueFrom(api.downloadMandateDocument(id, type));
      } catch {
        return null;
      }
    },
    loadSettings: async (): Promise<void> => {
      try {
        patchState(store, { settings: (await firstValueFrom(api.getSettings())).data });
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
      }
    },
    saveSettings: (payload: Partial<FvrSettings>): Promise<FvrOutcome> =>
      attempt(async () => {
        patchState(store, { settings: (await firstValueFrom(api.saveSettings(payload))).data });
      }),
  })),
);
