import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApAging, ApAgingFilters, ApExportFormat, PayablesApiService } from '@core';
import {
  agingFileName,
  apFailure,
  apiErrorMessage,
  ApOutcome,
  AP_OK,
  todayIso,
} from './payables.util';

export interface PayablesAgingState {
  filters: ApAgingFilters;
  aging: ApAging | null;
  loading: boolean;
  /** The export being prepared, for the loading state of the buttons. */
  exporting: ApExportFormat | null;
  error: string | null;
}

const initialState: PayablesAgingState = {
  filters: {},
  aging: null,
  loading: false,
  exporting: null,
  error: null,
};

export interface AgingExport extends ApOutcome {
  blob: Blob | null;
  filename: string;
}

/** Payables aging by supplier and time bucket, with the Excel and PDF exports. */
export const PayablesAgingStore = signalStore(
  withState(initialState),
  withComputed(({ aging }) => ({
    suppliers: computed(() => aging()?.suppliers ?? []),
    buckets: computed(() => aging()?.buckets ?? []),
    isEmpty: computed(() => (aging()?.suppliers.length ?? 0) === 0),
  })),
  withMethods((store, api = inject(PayablesApiService)) => {
    let sequence = 0;

    const load = async (filters: ApAgingFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getAging(filters));
        if (ticket === sequence) {
          patchState(store, { aging: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'AP.LOAD_ERROR' });
        }
      }
    };

    return {
      init: (filters: ApAgingFilters = {}): Promise<void> => load(filters),
      setFilters: (patch: Partial<ApAgingFilters>): Promise<void> =>
        load({ ...store.filters(), ...patch }),
      refresh: (): Promise<void> => load(store.filters()),

      /** Fetches the export file; the screen hands the blob to the browser. */
      async download(format: ApExportFormat): Promise<AgingExport> {
        const filename = agingFileName(
          store.aging()?.as_of ?? store.filters().as_of ?? todayIso(),
          format,
        );
        patchState(store, { exporting: format });
        try {
          const blob = await firstValueFrom(api.exportAging(format, store.filters()));
          patchState(store, { exporting: null });
          return { ...AP_OK, blob, filename };
        } catch (error) {
          patchState(store, { exporting: null });
          return { ...apFailure(error), blob: null, filename };
        }
      },
    };
  }),
);
