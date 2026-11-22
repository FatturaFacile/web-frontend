import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AccountLedgerReport,
  GeneralLedgerApiService,
  LedgerBookCode,
  LedgerTrialBalance,
} from '@core';
import { currentYearEnd, currentYearStart, rangeEndsBeforeStart } from '../shared/gl-dates';

export interface LedgerReportFilters {
  ledger: LedgerBookCode;
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  costCenterId: string | null;
  profitCenterId: string | null;
  columns: 2 | 4;
}

export interface LedgerReportsState {
  filters: LedgerReportFilters;
  /** Account shown in the mastrino. */
  accountId: string | null;
  trialBalance: LedgerTrialBalance | null;
  trialBalanceLoading: boolean;
  accountLedger: AccountLedgerReport | null;
  accountLedgerLoading: boolean;
  /** Tab of the reports page: 0 trial balance, 1 account ledger (a drill-down switches to it). */
  activeTab: number;
  error: unknown;
}

function initialState(): LedgerReportsState {
  return {
    filters: {
      ledger: '01',
      from: currentYearStart(),
      to: currentYearEnd(),
      compareFrom: '',
      compareTo: '',
      costCenterId: null,
      profitCenterId: null,
      columns: 4,
    },
    accountId: null,
    trialBalance: null,
    trialBalanceLoading: false,
    accountLedger: null,
    accountLedgerLoading: false,
    activeTab: 0,
    error: null,
  };
}

/** Shared state of the trial balance and the account ledger (mastrino): one set of filters, drill-down between the two. */
export const GlLedgerReportsStore = signalStore(
  { providedIn: 'root' },
  withState<LedgerReportsState>(initialState()),
  withMethods((store, api = inject(GeneralLedgerApiService)) => {
    const rangeInvalid = (): boolean => {
      const f = store.filters();
      return rangeEndsBeforeStart(f.from, f.to) || rangeEndsBeforeStart(f.compareFrom, f.compareTo);
    };

    const loadAccountLedger = async (page = 1): Promise<void> => {
      const accountId = store.accountId();
      const f = store.filters();
      if (!accountId || rangeEndsBeforeStart(f.from, f.to)) {
        return;
      }
      patchState(store, { accountLedgerLoading: true, error: null });
      try {
        const res = await firstValueFrom(
          api.getAccountLedger({
            account_id: accountId,
            from: f.from,
            to: f.to,
            page,
            per_page: 50,
            ledger: f.ledger,
            cost_center_id: f.costCenterId,
            profit_center_id: f.profitCenterId,
          }),
        );
        patchState(store, { accountLedger: res.data, accountLedgerLoading: false });
      } catch (error) {
        patchState(store, { accountLedgerLoading: false, error });
      }
    };

    return {
      rangeInvalid,
      loadAccountLedger,

      setFilters(changes: Partial<LedgerReportFilters>): void {
        patchState(store, { filters: { ...store.filters(), ...changes } });
      },

      setAccountId(accountId: string | null): void {
        patchState(store, { accountId });
      },

      setActiveTab(activeTab: number): void {
        patchState(store, { activeTab });
      },

      async loadTrialBalance(): Promise<void> {
        if (rangeInvalid()) {
          return;
        }
        const f = store.filters();
        patchState(store, { trialBalanceLoading: true, error: null });
        try {
          const res = await firstValueFrom(
            api.getTrialBalanceReport({
              from: f.from,
              to: f.to,
              compare_from: f.compareFrom || null,
              compare_to: f.compareTo || null,
              cost_center_id: f.costCenterId,
              profit_center_id: f.profitCenterId,
              ledger: f.ledger,
              columns: f.columns,
            }),
          );
          patchState(store, { trialBalance: res.data, trialBalanceLoading: false });
        } catch (error) {
          patchState(store, { trialBalanceLoading: false, error });
        }
      },

      /** Drill-down from a trial balance row: opens its mastrino for the same range, book and dimensions. */
      async openAccountLedger(accountId: string): Promise<void> {
        patchState(store, { accountId, activeTab: 1, accountLedger: null });
        await loadAccountLedger(1);
      },
    };
  }),
);
