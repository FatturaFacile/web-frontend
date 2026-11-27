import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { DownPaymentsApiService, DpChain, DpChainFilters, DpPageMeta } from '@core';
import { failureOf, fromCents, sumCents } from './down-payments.util';

export interface ChainsState {
  chains: DpChain[];
  meta: DpPageMeta | null;
  filters: DpChainFilters;
  loading: boolean;
  error: string | null;
}

export interface DpChainTotals {
  currency: string;
  count: number;
  contract: string;
  advances: string;
  deposits: string;
  residual: string;
}

/** The down-payment chains: filtered list with the totals of the page. */
export const ChainsStore = signalStore(
  withState<ChainsState>({
    chains: [],
    meta: null,
    filters: { per_page: 25 },
    loading: false,
    error: null,
  }),
  withComputed((store) => ({
    /** Totals of the page, one row per currency: EUR and CHF chains are never added together. */
    totals: computed<DpChainTotals[]>(() => {
      const byCurrency = new Map<string, DpChain[]>();
      for (const row of store.chains()) {
        byCurrency.set(row.currency, [...(byCurrency.get(row.currency) ?? []), row]);
      }
      return [...byCurrency.entries()].map(([currency, rows]) => ({
        currency,
        count: rows.length,
        contract: fromCents(sumCents(rows.map((row) => row.total_contract_gross))),
        advances: fromCents(sumCents(rows.map((row) => row.total_advance_invoiced_gross))),
        deposits: fromCents(
          sumCents(rows.map((row) => row.total_earnest_deposits_held)) +
            sumCents(rows.map((row) => row.total_security_deposits_held)),
        ),
        residual: fromCents(sumCents(rows.map((row) => row.residual_order_gross))),
      }));
    }),
  })),
  withMethods((store, api = inject(DownPaymentsApiService)) => ({
    load: async (filters?: DpChainFilters): Promise<void> => {
      const active = filters ?? store.filters();
      patchState(store, { filters: active, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listChains(active));
        patchState(store, { chains: response.data, meta: response.meta ?? null, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
  })),
);
