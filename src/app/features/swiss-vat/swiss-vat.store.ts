import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  BezugsteuerEntry,
  CalculateSwissVatReturnPayload,
  InputTaxAdjustment,
  SssSectorRate,
  StoreBezugsteuerPayload,
  StoreInputTaxAdjustmentPayload,
  StoreSwissVatTaxCodePayload,
  SuisseTaxValidationResult,
  SuisseTaxXmlExport,
  SwissVatApiService,
  SwissVatConfig,
  SwissVatReconciliationReport,
  SwissVatReturn,
  SwissVatTaxCode,
  UpsertSwissVatConfigPayload,
} from '@core';

export interface SwissVatState {
  config: SwissVatConfig | null;
  taxCodes: SwissVatTaxCode[];
  sssSectors: SssSectorRate[];
  bezugsteuer: BezugsteuerEntry[];
  adjustments: InputTaxAdjustment[];
  returns: SwissVatReturn[];
  selectedReturn: SwissVatReturn | null;
  reconciliation: SwissVatReconciliationReport | null;
  xmlValidation: SuisseTaxValidationResult | null;
  exports: SuisseTaxXmlExport[];
  loading: boolean;
  saving: boolean;
  error: unknown;
}

const initialState: SwissVatState = {
  config: null,
  taxCodes: [],
  sssSectors: [],
  bezugsteuer: [],
  adjustments: [],
  returns: [],
  selectedReturn: null,
  reconciliation: null,
  xmlValidation: null,
  exports: [],
  loading: false,
  saving: false,
  error: null,
};

/** NgRx SignalStore for Swiss VAT (MWST / IVA / TVA) Mod 024. */
export const SwissVatStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    pendingBezugsteuerCount: computed(
      () => store.bezugsteuer().filter((e) => e.status === 'detected').length,
    ),
    confirmedBezugsteuerCount: computed(
      () => store.bezugsteuer().filter((e) => e.status === 'confirmed' || e.status === 'declared').length,
    ),
    draftAdjustmentsCount: computed(
      () => store.adjustments().filter((a) => a.status === 'draft').length,
    ),
    latestReturn: computed(() => store.returns()[0] ?? null),
  })),
  withMethods((store) => {
    const api = inject(SwissVatApiService);

    async function runLoad<T>(fn: () => Promise<T>, onSuccess: (value: T) => void): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const res = await fn();
        onSuccess(res);
        patchState(store, { loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: err });
        throw err;
      }
    }

    async function runSave<T>(fn: () => Promise<T>, onSuccess: (value: T) => void): Promise<T> {
      patchState(store, { saving: true, error: null });
      try {
        const res = await fn();
        onSuccess(res);
        patchState(store, { saving: false });
        return res;
      } catch (err) {
        patchState(store, { saving: false, error: err });
        throw err;
      }
    }

    return {
      loadConfigAndCatalog: async (): Promise<void> => {
        await runLoad(
          async () =>
            Promise.all([
              firstValueFrom(api.getConfig()),
              firstValueFrom(api.getTaxCodes()),
              firstValueFrom(api.getSssSectors()),
            ]),
          ([cfg, codes, sectors]) => {
            patchState(store, {
              config: cfg.data,
              taxCodes: codes.data ?? [],
              sssSectors: sectors.data ?? [],
            });
          },
        );
      },

      saveConfig: async (payload: UpsertSwissVatConfigPayload): Promise<SwissVatConfig> => {
        const resp = await runSave(
          () => firstValueFrom(api.updateConfig(payload)),
          (r) => patchState(store, { config: r.data }),
        );
        return resp.data;
      },

      createTaxCode: async (payload: StoreSwissVatTaxCodePayload): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.createTaxCode(payload)),
          (r) => patchState(store, { taxCodes: [r.data, ...store.taxCodes()] }),
        );
      },

      loadBezugsteuer: async (params?: {
        status?: string;
        period_from?: string;
        period_to?: string;
      }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getBezugsteuer(params)),
          (r) => patchState(store, { bezugsteuer: r.data ?? [] }),
        );
      },

      detectBezugsteuer: async (from: string, to: string): Promise<BezugsteuerEntry[]> => {
        const resp = await runSave(
          () => firstValueFrom(api.detectBezugsteuer(from, to)),
          (r) => {
            const added = r.data ?? [];
            if (added.length > 0) {
              patchState(store, { bezugsteuer: [...added, ...store.bezugsteuer()] });
            }
          },
        );
        return resp.data ?? [];
      },

      createBezugsteuer: async (payload: StoreBezugsteuerPayload): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.createBezugsteuer(payload)),
          (r) => patchState(store, { bezugsteuer: [r.data, ...store.bezugsteuer()] }),
        );
      },

      confirmBezugsteuer: async (id: string): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.confirmBezugsteuer(id)),
          (r) =>
            patchState(store, {
              bezugsteuer: store.bezugsteuer().map((e) => (e.id === id ? r.data : e)),
            }),
        );
      },

      excludeBezugsteuer: async (id: string): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.excludeBezugsteuer(id)),
          (r) =>
            patchState(store, {
              bezugsteuer: store.bezugsteuer().map((e) => (e.id === id ? r.data : e)),
            }),
        );
      },

      loadAdjustments: async (year?: number): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getAdjustments({ year })),
          (r) => patchState(store, { adjustments: r.data ?? [] }),
        );
      },

      createAdjustment: async (payload: StoreInputTaxAdjustmentPayload): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.createAdjustment(payload)),
          (r) => patchState(store, { adjustments: [r.data, ...store.adjustments()] }),
        );
      },

      approveAdjustment: async (id: string): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.approveAdjustment(id)),
          (r) =>
            patchState(store, {
              adjustments: store.adjustments().map((a) => (a.id === id ? r.data : a)),
            }),
        );
      },

      deleteAdjustment: async (id: string): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.deleteAdjustment(id)),
          () =>
            patchState(store, {
              adjustments: store.adjustments().filter((a) => a.id !== id),
            }),
        );
      },

      loadReturns: async (year?: number): Promise<void> => {
        await runLoad(
          async () =>
            Promise.all([firstValueFrom(api.getConfig()), firstValueFrom(api.getReturns(year))]),
          ([cfg, ret]) =>
            patchState(store, {
              config: cfg.data,
              returns: ret.data ?? [],
            }),
        );
      },

      calculateReturn: async (payload: CalculateSwissVatReturnPayload): Promise<SwissVatReturn> => {
        const resp = await runSave(
          () => firstValueFrom(api.calculateReturn(payload)),
          (r) => {
            const exists = store.returns().some((item) => item.id === r.data.id);
            patchState(store, {
              selectedReturn: r.data,
              returns: exists
                ? store.returns().map((item) => (item.id === r.data.id ? r.data : item))
                : [r.data, ...store.returns()],
            });
          },
        );
        return resp.data;
      },

      loadReconciliationWorkspace: async (id: string): Promise<void> => {
        await runLoad(
          async () =>
            Promise.all([
              firstValueFrom(api.getReturn(id)),
              firstValueFrom(api.getReconciliation(id)),
              firstValueFrom(api.getReturnExports(id)),
            ]),
          ([ret, recon, exps]) =>
            patchState(store, {
              selectedReturn: ret.data,
              reconciliation: recon.data,
              exports: exps.data ?? [],
              xmlValidation: null,
            }),
        );
      },

      validateXml: async (id: string): Promise<SuisseTaxValidationResult> => {
        const resp = await runSave(
          () => firstValueFrom(api.validateReturnXml(id)),
          (r) => patchState(store, { xmlValidation: r.data }),
        );
        return resp.data;
      },

      finalizeReturn: async (id: string): Promise<SwissVatReturn> => {
        const resp = await runSave(
          () => firstValueFrom(api.finalizeReturn(id)),
          (r) =>
            patchState(store, {
              selectedReturn: r.data,
              returns: store.returns().map((item) => (item.id === id ? r.data : item)),
            }),
        );
        return resp.data;
      },

      exportXml: async (id: string): Promise<SuisseTaxXmlExport> => {
        const resp = await runSave(
          () => firstValueFrom(api.exportReturnXml(id)),
          (r) => patchState(store, { exports: [r.data, ...store.exports()] }),
        );
        return resp.data;
      },
    };
  }),
);
