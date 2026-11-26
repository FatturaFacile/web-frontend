import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PcImportMode, PcImportReport, PcImportSchema, ProductCatalogApiService } from '@core';
import { failureOf, PC_OK, PcOutcome, saveBlob } from './product-catalog.util';

export interface CatalogTransferState {
  schema: PcImportSchema | null;
  report: PcImportReport | null;
  busy: boolean;
  error: string | null;
}

/** Bulk exchange of the catalog: the schema of the file, the template, the export and the import with its row-level report. */
export const CatalogTransferStore = signalStore(
  withState<CatalogTransferState>({ schema: null, report: null, busy: false, error: null }),
  withMethods((store, api = inject(ProductCatalogApiService)) => ({
    async init(): Promise<void> {
      try {
        const response = await firstValueFrom(api.getImportSchema());
        patchState(store, { schema: response.data });
      } catch (error) {
        patchState(store, { error: failureOf(error).errorKey });
      }
    },

    async export(format: 'csv' | 'xlsx'): Promise<PcOutcome> {
      patchState(store, { busy: true });
      try {
        saveBlob(await firstValueFrom(api.exportCatalog(format)), `catalog.${format}`);
        patchState(store, { busy: false });
        return PC_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    },

    async template(format: 'csv' | 'xlsx'): Promise<PcOutcome> {
      patchState(store, { busy: true });
      try {
        saveBlob(await firstValueFrom(api.downloadTemplate(format)), `catalog-template.${format}`);
        patchState(store, { busy: false });
        return PC_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    },

    async import(file: File, mode: PcImportMode): Promise<PcOutcome> {
      patchState(store, { busy: true, report: null });
      try {
        const response = await firstValueFrom(api.importFile(file, mode));
        patchState(store, { busy: false, report: response.data });
        return PC_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    },

    clearReport(): void {
      patchState(store, { report: null });
    },
  })),
);
