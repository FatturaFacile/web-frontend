import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { CcvRoi, CcvRoiFilters, CcvRoiRow, CorporateConventionsApiService } from '@core';
import { CCV_OK, CcvOutcome, failureOf, saveBlob, toNumber } from './corporate-conventions.util';

export interface DashboardState {
  filters: CcvRoiFilters;
  roi: CcvRoi | null;
  loading: boolean;
  exporting: boolean;
  error: string | null;
}

/** ROI dashboard of the commercial director: KPIs and one row per convention, in one currency at a time. */
export const DashboardStore = signalStore(
  withState<DashboardState>({
    filters: {},
    roi: null,
    loading: false,
    exporting: false,
    error: null,
  }),
  withComputed(({ roi }) => ({
    kpis: computed(() => roi()?.kpis ?? null),
    rows: computed<CcvRoiRow[]>(() => roi()?.conventions ?? []),
    currency: computed(() => roi()?.currency ?? 'EUR'),
    /** The largest net revenue of the rows: the scale of the bars. */
    maxNetRevenue: computed(() =>
      Math.max(0, ...(roi()?.conventions ?? []).map((row) => toNumber(row.net_revenue))),
    ),
    /** The best conventions by net margin first. */
    byMargin: computed<CcvRoiRow[]>(() =>
      [...(roi()?.conventions ?? [])].sort(
        (a, b) => toNumber(b.net_margin) - toNumber(a.net_margin),
      ),
    ),
  })),
  withMethods((store, api = inject(CorporateConventionsApiService)) => {
    let sequence = 0;

    const load = async (filters: CcvRoiFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getRoi(filters));
        if (ticket === sequence) {
          patchState(store, { roi: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    return {
      init: (): Promise<void> => load(store.filters()),
      load: (filters: CcvRoiFilters = store.filters()): Promise<void> => load(filters),
      setFilters: (patch: Partial<CcvRoiFilters>): Promise<void> =>
        load({ ...store.filters(), ...patch }),
      /** Downloads the table of the dashboard as CSV. */
      async exportCsv(): Promise<CcvOutcome> {
        patchState(store, { exporting: true });
        try {
          const blob = await firstValueFrom(api.exportRoi(store.filters()));
          saveBlob(blob, 'corporate-conventions-roi.csv');
          patchState(store, { exporting: false });
          return CCV_OK;
        } catch (error) {
          patchState(store, { exporting: false });
          return failureOf(error);
        }
      },
    };
  }),
);
