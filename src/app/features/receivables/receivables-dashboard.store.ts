import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ArAging,
  ArAgingCustomer,
  ArBlockedCustomer,
  ArBucket,
  ArDashboard,
  ArProvisionPostingResult,
  ReceivablesApiService,
} from '@core';
import {
  apiErrorMessage,
  ArOutcome,
  arFailure,
  AR_OK,
  barShare,
  compareAmounts,
} from './receivables.util';

export interface DashboardState {
  /** Currency of every aggregate; `null` until the API tells the company currency. */
  currency: string | null;
  dashboard: ArDashboard | null;
  loading: boolean;
  /** A provision posting is in flight. */
  posting: boolean;
  /** Result of the last provision posting. */
  lastPosting: ArProvisionPostingResult | null;
  /** Message of the API, or a translation key when the API gave none. */
  error: string | null;
}

const initialState: DashboardState = {
  currency: null,
  dashboard: null,
  loading: false,
  posting: false,
  lastPosting: null,
  error: null,
};

/** A blocked customer with the name taken from the aging report (the dashboard lists ids only). */
export interface BlockedRow extends ArBlockedCustomer {
  customer_name: string | null;
}

export interface AgingBarRow {
  bucket: ArBucket;
  amount: string;
  share: number;
}

/** State of the AR and credit dashboard: KPIs, the aging chart and matrix and the blocked customers. */
export const ReceivablesDashboardStore = signalStore(
  withState(initialState),
  withComputed(({ dashboard, currency }) => {
    const aging = computed<ArAging | null>(() => dashboard()?.aging ?? null);
    const buckets = computed<ArBucket[]>(() => aging()?.buckets ?? []);
    const customers = computed<ArAgingCustomer[]>(() =>
      [...(aging()?.customers ?? [])].sort((a, b) => compareAmounts(b.total_open, a.total_open)),
    );

    return {
      kpis: computed(() => dashboard()?.kpis ?? null),
      aging,
      buckets,
      /** The currency of the figures on screen: the one asked for, else the one of the response. */
      activeCurrency: computed(() => currency() ?? dashboard()?.currency ?? null),
      availableCurrencies: computed(() => aging()?.available_currencies ?? []),
      /** Customers with the biggest open amount first. */
      customers,
      /** Bars of the aging chart, in the order of the buckets of the response. */
      bars: computed<AgingBarRow[]>(() => {
        const totals = aging()?.totals ?? {};
        const amounts = buckets().map((bucket) => totals[bucket.key] ?? '0.00');
        const max = amounts.reduce((top, value) => (compareAmounts(value, top) > 0 ? value : top), '0.00');
        return buckets().map((bucket, index) => ({
          bucket,
          amount: amounts[index],
          share: barShare(amounts[index], max),
        }));
      }),
      blocked: computed<BlockedRow[]>(() => {
        const names = new Map(customers().map((row) => [row.customer_id, row.customer_name]));
        return (dashboard()?.blocked ?? []).map((row) => ({
          ...row,
          customer_name: names.get(row.customer_id) ?? null,
        }));
      }),
      hasData: computed(() => dashboard() !== null),
      isEmpty: computed(() => (aging()?.customers.length ?? 0) === 0),
    };
  }),
  withMethods((store, api = inject(ReceivablesApiService)) => {
    let sequence = 0;

    const load = async (currency?: string | null): Promise<void> => {
      const ticket = ++sequence;
      const requested = currency === undefined ? store.currency() : currency;
      patchState(store, { loading: true, error: null, currency: requested });
      try {
        const response = await firstValueFrom(api.getDashboard(requested ?? undefined));
        if (ticket === sequence) {
          patchState(store, { dashboard: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, {
            loading: false,
            error: apiErrorMessage(error) ?? 'AR.LOAD_ERROR',
          });
        }
      }
    };

    /** Books the provision to the general ledger and re-reads the dashboard when something was posted. */
    const postProvision = async (): Promise<ArOutcome & { result: ArProvisionPostingResult | null }> => {
      patchState(store, { posting: true });
      try {
        const currency = store.currency() ?? store.dashboard()?.currency ?? undefined;
        const response = await firstValueFrom(api.postProvision(currency));
        patchState(store, { posting: false, lastPosting: response.data });
        if (response.data.posted) {
          await load();
        }
        return { ...AR_OK, result: response.data };
      } catch (error) {
        patchState(store, { posting: false });
        return { ...arFailure(error), result: null };
      }
    };

    return {
      load,
      postProvision,
      /** Re-reads every figure in another currency. */
      setCurrency: (currency: string): Promise<void> => load(currency),
      refresh: (): Promise<void> => load(),
    };
  }),
);
