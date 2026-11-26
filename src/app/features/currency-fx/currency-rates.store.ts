import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CurrencyApiService,
  CurrencyExportFormat,
  CurrencyRate,
  CurrencyRateFilters,
  LaravelPaginationMeta,
} from '@core';
import { currencyProblemText, downloadBlob } from '@shared';
import { trendPoints } from './currency-fx.util';

export interface CurrencyRatesState {
  filters: CurrencyRateFilters;
  rates: CurrencyRate[];
  meta: LaravelPaginationMeta | null;
  /** Rates of the filtered pair (both currencies chosen) for the trend line. */
  trendRates: CurrencyRate[];
  loading: boolean;
  /** Translation key of the last failure, null when the last call worked. */
  error: string | null;
  /** Text the API sent with the failure, when it sent one. */
  errorDetail: string | null;
  exporting: boolean;
}

export const RATES_PAGE_SIZE = 25;
/** The trend looks at the last rates of the pair, whatever the page of the table. */
export const TREND_SIZE = 90;

/** The exchange rates table: filters, paging, the trend of the filtered pair and the audit export. */
export const CurrencyRatesStore = signalStore(
  withState<CurrencyRatesState>({
    filters: { per_page: RATES_PAGE_SIZE, page: 1 },
    rates: [],
    meta: null,
    trendRates: [],
    loading: false,
    error: null,
    errorDetail: null,
    exporting: false,
  }),
  withComputed(({ meta, trendRates, filters }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? RATES_PAGE_SIZE),
    pairSelected: computed(() => !!filters().base && !!filters().quote),
    trend: computed(() => trendPoints(trendRates())),
  })),
  withMethods((store, api = inject(CurrencyApiService)) => {
    let sequence = 0;

    const loadTrend = async (filters: CurrencyRateFilters, ticket: number): Promise<void> => {
      if (!filters.base || !filters.quote) {
        patchState(store, { trendRates: [] });
        return;
      }
      try {
        const response = await firstValueFrom(
          api.listRates({ ...filters, page: 1, per_page: TREND_SIZE }),
        );
        if (ticket === sequence) {
          patchState(store, { trendRates: response.data });
        }
      } catch {
        if (ticket === sequence) {
          patchState(store, { trendRates: [] });
        }
      }
    };

    const load = async (filters: CurrencyRateFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null, errorDetail: null });
      void loadTrend(filters, ticket);
      try {
        const response = await firstValueFrom(api.listRates(filters));
        if (ticket === sequence) {
          patchState(store, { rates: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, {
            loading: false,
            error: 'FINANCE.CURRENCIES.ERROR.LOAD_FAILED',
            errorDetail: currencyProblemText(error),
          });
        }
      }
    };

    return {
      init: (): Promise<void> => load(store.filters()),
      reload: (): Promise<void> => load(store.filters()),
      /** Applies filters from the first page; an empty value clears the filter. */
      setFilters: (patch: Partial<CurrencyRateFilters>): Promise<void> =>
        load({ ...store.filters(), ...patch, page: 1 }),
      setPage: (page: number): Promise<void> => load({ ...store.filters(), page }),
      /** Downloads the rates used in the filtered period as CSV or XLSX (the audit export). */
      async exportRates(format: CurrencyExportFormat): Promise<boolean> {
        const { from, to } = store.filters();
        patchState(store, { exporting: true, error: null, errorDetail: null });
        try {
          const blob = await firstValueFrom(api.exportRates({ from, to }, format));
          downloadBlob(blob, `exchange-rates.${format}`);
          return true;
        } catch (error) {
          patchState(store, {
            error: 'FINANCE.CURRENCIES.ERROR.EXPORT_FAILED',
            errorDetail: currencyProblemText(error),
          });
          return false;
        } finally {
          patchState(store, { exporting: false });
        }
      },
    };
  }),
);
