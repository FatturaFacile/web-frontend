import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  SctCrossBorder,
  SctExportFormat,
  SctPageMeta,
  SctRegisterFilters,
  SctRegisterLine,
  SubcontractingApiService,
} from '@core';
import { failureOf, registerFilename, saveBlob, SCT_OK, SctOutcome } from './subcontracting.util';

export interface RegisterState {
  lines: SctRegisterLine[];
  meta: SctPageMeta | null;
  filters: SctRegisterFilters;
  crossBorder: SctCrossBorder | null;
  loading: boolean;
  exporting: boolean;
  error: string | null;
}

/** The statutory register of the goods in conto lavoro (Art. 53 DPR 633/72) and the TPP / TPA summary beside it. */
export const RegisterStore = signalStore(
  withState<RegisterState>({
    lines: [],
    meta: null,
    filters: { per_page: 50 },
    crossBorder: null,
    loading: false,
    exporting: false,
    error: null,
  }),
  withMethods((store, api = inject(SubcontractingApiService)) => ({
    load: async (filters?: SctRegisterFilters): Promise<void> => {
      const active = filters ?? store.filters();
      patchState(store, { filters: active, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getRegister(active));
        patchState(store, { lines: response.data, meta: response.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    loadCrossBorder: async (customsRegime?: string): Promise<void> => {
      try {
        patchState(store, { crossBorder: (await firstValueFrom(api.getCrossBorder(customsRegime))).data });
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
      }
    },
    /** Downloads the register of the current filters as CSV, Excel or PDF. */
    exportRegister: async (format: SctExportFormat): Promise<SctOutcome> => {
      patchState(store, { exporting: true });
      try {
        const filters: SctRegisterFilters = { ...store.filters() };
        delete filters.per_page;
        delete filters.page;
        saveBlob(await firstValueFrom(api.exportRegister(format, filters)), registerFilename(format));
        patchState(store, { exporting: false });
        return SCT_OK;
      } catch (error) {
        patchState(store, { exporting: false });
        return failureOf(error);
      }
    },
  })),
);
