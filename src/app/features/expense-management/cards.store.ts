import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ExmCardAccount,
  ExmCardFilters,
  ExmCardTransaction,
  ExmDecimal,
  ExmLine,
  ExmPageMeta,
  ExmReconcileAction,
  ExmReport,
  ExpenseManagementApiService,
} from '@core';
import { EXM_OK, ExmOutcome, failureOf, toNumber } from './expense-management.util';

/** One expense line chosen for a match, with the part of the transaction it covers (split). */
export interface CardMatchSelection {
  line: ExmLine;
  amount: ExmDecimal;
}

export interface CardsState {
  filters: ExmCardFilters;
  transactions: ExmCardTransaction[];
  meta: ExmPageMeta | null;
  accounts: ExmCardAccount[];
  /** Reports whose card expenses can be matched (drafts and sent-back ones). */
  reports: ExmReport[];
  /** The transaction being reconciled. */
  selected: ExmCardTransaction | null;
  /** Card expense lines of the report open beside the transaction. */
  lines: ExmLine[];
  loading: boolean;
  busy: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

const initialState: CardsState = {
  filters: { status: 'unmatched', per_page: PAGE_SIZE, page: 1 },
  transactions: [],
  meta: null,
  accounts: [],
  reports: [],
  selected: null,
  lines: [],
  loading: false,
  busy: false,
  error: null,
};

/** Lines a card transaction can still be matched with: card payments not yet linked to a transaction. */
export function matchableLines(lines: readonly ExmLine[]): ExmLine[] {
  return lines.filter(
    (line) =>
      line.payment_method === 'corporate_card' && line.corporate_card_transaction_id === null,
  );
}

/** Corporate card reconciliation: transactions on one side, the card expense lines of a report on the other. */
export const CardsStore = signalStore(
  withState(initialState),
  withComputed(({ meta, lines }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    candidates: computed(() => matchableLines(lines())),
  })),
  withMethods((store, api = inject(ExpenseManagementApiService)) => {
    let sequence = 0;

    const load = async (filters: ExmCardFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listCardTransactions(filters));
        if (ticket === sequence) {
          const selectedId = store.selected()?.id;
          patchState(store, {
            transactions: response.data,
            meta: response.meta,
            loading: false,
            selected: response.data.find((item) => item.id === selectedId) ?? null,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    return {
      async init(): Promise<void> {
        const [accounts, drafts, rejected] = await Promise.all([
          firstValueFrom(api.listCardAccounts()).catch(() => null),
          firstValueFrom(api.listReports({ status: 'draft', per_page: 100 })).catch(() => null),
          firstValueFrom(api.listReports({ status: 'rejected', per_page: 100 })).catch(() => null),
        ]);
        patchState(store, {
          accounts: accounts?.data ?? [],
          reports: [...(drafts?.data ?? []), ...(rejected?.data ?? [])],
        });
        await load(store.filters());
      },
      load: (filters: ExmCardFilters = store.filters()): Promise<void> => load(filters),
      setFilters(patch: Partial<ExmCardFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      select(transaction: ExmCardTransaction | null): void {
        patchState(store, { selected: transaction });
      },
      async openReport(reportId: string | null): Promise<void> {
        if (!reportId) {
          patchState(store, { lines: [] });
          return;
        }
        try {
          const response = await firstValueFrom(api.getReport(reportId));
          patchState(store, { lines: response.data.lines });
        } catch (error) {
          patchState(store, { lines: [], error: (await failureOf(error)).errorKey });
        }
      },
      /** Matches the transaction with one line (the whole transaction) or with several (a split). */
      async match(
        transaction: ExmCardTransaction,
        selections: readonly CardMatchSelection[],
      ): Promise<ExmOutcome> {
        patchState(store, { busy: true });
        try {
          await firstValueFrom(
            api.reconcileCardTransaction(transaction.id, {
              action: 'match',
              matches: selections.map((selection) => ({
                expense_line_id: selection.line.id,
                amount: selection.amount,
              })),
            }),
          );
          patchState(store, { busy: false });
          await load(store.filters());
          return EXM_OK;
        } catch (error) {
          patchState(store, { busy: false });
          return failureOf(error);
        }
      },
      async act(
        transaction: ExmCardTransaction,
        action: Exclude<ExmReconcileAction, 'match'>,
      ): Promise<ExmOutcome> {
        patchState(store, { busy: true });
        try {
          await firstValueFrom(api.reconcileCardTransaction(transaction.id, { action }));
          patchState(store, { busy: false });
          await load(store.filters());
          return EXM_OK;
        } catch (error) {
          patchState(store, { busy: false });
          return failureOf(error);
        }
      },
    };
  }),
);

/** The part of the transaction left after the selections; negative when they cover more than it. */
export function remainingAfter(
  transaction: ExmCardTransaction,
  selections: readonly CardMatchSelection[],
): number {
  const covered = selections.reduce((sum, selection) => sum + toNumber(selection.amount), 0);
  return Math.round((toNumber(transaction.remaining_amount) - covered) * 100) / 100;
}
