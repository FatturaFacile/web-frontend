import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ArLedger, ArLedgerFilters, ReceivablesApiService } from '@core';
import { apiErrorMessage, sumAmounts } from './receivables.util';

export interface CustomerLedgerState {
  customerId: string | null;
  filters: ArLedgerFilters;
  ledger: ArLedger | null;
  loading: boolean;
  error: string | null;
}

const initialState: CustomerLedgerState = {
  customerId: null,
  filters: {},
  ledger: null,
  loading: false,
  error: null,
};

/** The customer ledger (Mastrino Clienti): documents and allocations in date order with the running balance. */
export const CustomerLedgerStore = signalStore(
  withState(initialState),
  withComputed(({ ledger }) => ({
    movements: computed(() => ledger()?.movements ?? []),
    closingBalance: computed(() => ledger()?.closing_balance ?? null),
    totalDebit: computed(() => sumAmounts((ledger()?.movements ?? []).map((row) => row.debit))),
    totalCredit: computed(() => sumAmounts((ledger()?.movements ?? []).map((row) => row.credit))),
    /** Currencies of the movements: a ledger in one currency is a coherent running balance. */
    currencies: computed(() => [...new Set((ledger()?.movements ?? []).map((row) => row.currency))]),
  })),
  withMethods((store, api = inject(ReceivablesApiService)) => {
    let sequence = 0;

    const fetch = async (customerId: string, filters: ArLedgerFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { customerId, filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getLedger(customerId, filters));
        if (ticket === sequence) {
          patchState(store, { ledger: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'AR.LOAD_ERROR' });
        }
      }
    };

    return {
      /** Opens the ledger of a customer; another customer starts with clean filters. */
      load: (customerId: string, filters: ArLedgerFilters = {}): Promise<void> => {
        if (customerId !== store.customerId()) {
          patchState(store, { ledger: null });
        }
        return fetch(customerId, filters);
      },
      setFilters(patch: Partial<ArLedgerFilters>): Promise<void> {
        const customerId = store.customerId();
        return customerId ? fetch(customerId, { ...store.filters(), ...patch }) : Promise.resolve();
      },
      refresh(): Promise<void> {
        const customerId = store.customerId();
        return customerId ? fetch(customerId, store.filters()) : Promise.resolve();
      },
      clear(): void {
        sequence++;
        patchState(store, initialState);
      },
    };
  }),
);
