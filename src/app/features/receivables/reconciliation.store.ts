import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ArAllocationLine,
  ArAllocationType,
  ArItem,
  ArUnreconciledPayment,
  ReceivablesApiService,
} from '@core';
import {
  addAmounts,
  arFailure,
  ArOutcome,
  compareAmounts,
  isPositiveAmount,
  minAmount,
  parseAmount,
  subAmounts,
  sumAmounts,
} from './receivables.util';

/** One row of the reconciliation form: an amount of one kind taken from or booked on one open item. */
export interface AllocationDraft {
  uid: number;
  itemId: string;
  type: ArAllocationType;
  amount: string;
  /** `YYYY-MM-DD` */
  valueDate: string;
  /** Ledger entry id of an unreconciled payment, or the id of the credit note invoice. */
  sourceId: string | null;
  reference: string;
  notes: string;
}

/** Translation keys of the problems of a draft line. */
export type DraftError =
  | 'AR.ERR_AMOUNT'
  | 'AR.ERR_DATE'
  | 'AR.ERR_EXCEEDS_RESIDUAL'
  | 'AR.ERR_SOURCE_REQUIRED'
  | 'AR.ERR_PAYMENT_EXCEEDED';

/** Per open item: what the draft allocates and what stays open afterwards. */
export interface ItemResidual {
  item: ArItem;
  /** Sum of the lines that settle the item (payment, credit note, write-off, discount). */
  settled: string;
  /** Sum of the debit adjustments, which raise the open amount. */
  raised: string;
  residual: string;
}

export interface ReconciliationState {
  customerId: string | null;
  items: ArItem[];
  lines: AllocationDraft[];
  payments: ArUnreconciledPayment[];
  paymentsLoading: boolean;
  saving: boolean;
  nextUid: number;
  /** Message of the API for the last refused submit. */
  error: string | null;
  errors: Record<string, string[]>;
}

const initialState: ReconciliationState = {
  customerId: null,
  items: [],
  lines: [],
  payments: [],
  paymentsLoading: false,
  saving: false,
  nextUid: 1,
  error: null,
  errors: {},
};

const RAISES_OPEN_AMOUNT: ArAllocationType = 'debit_adjustment';

function emptyDraft(uid: number, item: ArItem, amount: string, valueDate: string): AllocationDraft {
  return {
    uid,
    itemId: item.id,
    type: 'payment',
    amount,
    valueDate,
    sourceId: null,
    reference: '',
    notes: '',
  };
}

/**
 * State of the reconciliation drawer: the lines allocated to the selected open items (partial or full), the residual
 * of every item and the pick of unreconciled payments. All amounts are checked as integer cents.
 */
export const ReconciliationStore = signalStore(
  withState(initialState),
  withComputed(({ items, lines, payments }) => {
    const residuals = computed<ItemResidual[]>(() =>
      items().map((item) => {
        const own = lines().filter((line) => line.itemId === item.id);
        const settled = sumAmounts(
          own.filter((line) => line.type !== RAISES_OPEN_AMOUNT).map((line) => line.amount),
        );
        const raised = sumAmounts(
          own.filter((line) => line.type === RAISES_OPEN_AMOUNT).map((line) => line.amount),
        );
        return {
          item,
          settled,
          raised,
          residual: addAmounts(subAmounts(item.open_amount, settled), raised),
        };
      }),
    );

    /** What is left of every unreconciled payment after the lines of the draft. */
    const paymentRemaining = computed<Record<string, string>>(() => {
      const result: Record<string, string> = {};
      for (const payment of payments()) {
        const used = sumAmounts(
          lines()
            .filter((line) => line.type === 'payment' && line.sourceId === payment.ledger_entry_id)
            .map((line) => line.amount),
        );
        result[payment.ledger_entry_id] = subAmounts(payment.unallocated, used);
      }
      return result;
    });

    const lineErrors = computed<Record<number, DraftError[]>>(() => {
      const byItem = new Map(residuals().map((row) => [row.item.id, row]));
      const result: Record<number, DraftError[]> = {};
      for (const line of lines()) {
        const problems: DraftError[] = [];
        if (!isPositiveAmount(line.amount)) {
          problems.push('AR.ERR_AMOUNT');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(line.valueDate)) {
          problems.push('AR.ERR_DATE');
        }
        const row = byItem.get(line.itemId);
        if (row && line.type !== RAISES_OPEN_AMOUNT && parseAmount(row.residual) !== null) {
          if (compareAmounts(row.residual, '0.00') < 0) {
            problems.push('AR.ERR_EXCEEDS_RESIDUAL');
          }
        }
        if (line.type === 'credit_note' && !line.sourceId) {
          problems.push('AR.ERR_SOURCE_REQUIRED');
        }
        if (line.type === 'payment' && line.sourceId) {
          const remaining = paymentRemaining()[line.sourceId];
          if (remaining !== undefined && compareAmounts(remaining, '0.00') < 0) {
            problems.push('AR.ERR_PAYMENT_EXCEEDED');
          }
        }
        if (problems.length > 0) {
          result[line.uid] = problems;
        }
      }
      return result;
    });

    return {
      residuals,
      paymentRemaining,
      lineErrors,
      isValid: computed(() => lines().length > 0 && Object.keys(lineErrors()).length === 0),
      totalSettled: computed(() =>
        sumAmounts(lines().filter((line) => line.type !== RAISES_OPEN_AMOUNT).map((line) => line.amount)),
      ),
    };
  }),
  withMethods((store, api = inject(ReceivablesApiService)) => {
    /** The most a line can still take: the open amount minus the other lines of the same item. */
    const capacityOf = (uid: number): string => {
      const line = store.lines().find((row) => row.uid === uid);
      const item = line ? store.items().find((row) => row.id === line.itemId) : undefined;
      if (!line || !item) {
        return '0.00';
      }
      const others = store.lines().filter((row) => row.itemId === line.itemId && row.uid !== uid);
      const settled = sumAmounts(
        others.filter((row) => row.type !== RAISES_OPEN_AMOUNT).map((row) => row.amount),
      );
      const raised = sumAmounts(
        others.filter((row) => row.type === RAISES_OPEN_AMOUNT).map((row) => row.amount),
      );
      const capacity = addAmounts(subAmounts(item.open_amount, settled), raised);
      return compareAmounts(capacity, '0.00') < 0 ? '0.00' : capacity;
    };

    const patchLine = (uid: number, patch: Partial<AllocationDraft>): void => {
      patchState(store, {
        lines: store.lines().map((line) => (line.uid === uid ? { ...line, ...patch } : line)),
      });
    };

    return {
      capacityOf,

      /** Starts a reconciliation of the items: one line per item for the full open amount, as a payment. */
      init(items: readonly ArItem[], today: string): void {
        const lines = items.map((item, index) => emptyDraft(index + 1, item, item.open_amount, today));
        patchState(store, {
          ...initialState,
          customerId: items[0]?.customer_id ?? null,
          items: [...items],
          lines,
          nextUid: lines.length + 1,
        });
      },

      /** Unreconciled payments of the customer, for the payment picker. */
      async loadPayments(): Promise<void> {
        const customerId = store.customerId();
        if (!customerId) {
          return;
        }
        patchState(store, { paymentsLoading: true });
        try {
          const response = await firstValueFrom(api.getUnreconciledPayments(customerId));
          const currencies = new Set(store.items().map((item) => item.currency));
          patchState(store, {
            payments: response.data.filter((payment) => currencies.has(payment.currency)),
            paymentsLoading: false,
          });
        } catch {
          patchState(store, { payments: [], paymentsLoading: false });
        }
      },

      addLine(itemId: string, today: string): void {
        const item = store.items().find((row) => row.id === itemId);
        if (!item) {
          return;
        }
        const uid = store.nextUid();
        patchState(store, {
          lines: [...store.lines(), emptyDraft(uid, item, '', today)],
          nextUid: uid + 1,
        });
        const capacity = capacityOf(uid);
        patchLine(uid, { amount: isPositiveAmount(capacity) ? capacity : '' });
      },

      removeLine(uid: number): void {
        patchState(store, { lines: store.lines().filter((line) => line.uid !== uid) });
      },

      updateLine(uid: number, patch: Partial<Omit<AllocationDraft, 'uid'>>): void {
        patchLine(uid, patch);
      },

      /** Another kind of allocation: the source of the previous kind no longer applies. */
      setType(uid: number, type: ArAllocationType): void {
        patchLine(uid, { type, sourceId: null, reference: '' });
      },

      /** Takes the whole residual of the item on the line. */
      setFull(uid: number): void {
        const line = store.lines().find((row) => row.uid === uid);
        if (!line || line.type === RAISES_OPEN_AMOUNT) {
          return;
        }
        patchLine(uid, { amount: capacityOf(uid) });
      },

      /** Picks an unreconciled payment: its date becomes the value date, its amount (up to the residual) the amount. */
      pickPayment(uid: number, ledgerEntryId: string | null): void {
        if (ledgerEntryId === null) {
          patchLine(uid, { sourceId: null, reference: '' });
          return;
        }
        const payment = store.payments().find((row) => row.ledger_entry_id === ledgerEntryId);
        if (!payment) {
          return;
        }
        const others = store
          .lines()
          .filter((row) => row.uid !== uid && row.type === 'payment' && row.sourceId === ledgerEntryId);
        const available = subAmounts(payment.unallocated, sumAmounts(others.map((row) => row.amount)));
        const amount = minAmount(capacityOf(uid), available);
        patchLine(uid, {
          sourceId: ledgerEntryId,
          reference: payment.reference ?? '',
          valueDate: payment.date,
          amount: isPositiveAmount(amount) ? amount : '',
        });
      },

      /** Sends the lines; the answer carries the fresh state of the items. */
      async submit(): Promise<ArOutcome & { items: ArItem[] }> {
        if (!store.isValid()) {
          return { ok: false, message: null, errors: {}, items: [] };
        }
        patchState(store, { saving: true, error: null, errors: {} });
        const allocations: ArAllocationLine[] = store.lines().map((line) => ({
          receivable_item_id: line.itemId,
          type: line.type,
          amount: line.amount,
          value_date: line.valueDate,
          ...(line.sourceId ? { source_id: line.sourceId } : {}),
          ...(line.reference.trim() ? { reference: line.reference.trim() } : {}),
          ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
        }));
        try {
          const response = await firstValueFrom(api.allocate({ allocations }));
          patchState(store, { saving: false });
          return { ok: true, message: null, errors: {}, items: response.data.items };
        } catch (error) {
          const failure = arFailure(error);
          patchState(store, { saving: false, error: failure.message, errors: failure.errors });
          return { ...failure, items: [] };
        }
      },
    };
  }),
);
