import { computed, inject } from '@angular/core';
import { PurchaseOrderFulfilmentApiService } from '@data-access/procurement/purchase-order-fulfilment-api.service';
import {
  CreateDropshipPayload,
  DispatchPurchaseOrderPayload,
  Dropshipment,
  DropshipFilters,
  IssueDdtPayload,
  OverdueOrderRow,
  PurchaseOrderConfirmation,
  PurchaseOrderDispatch,
  PurchaseOrderReminder,
  RecordDeliveryPayload,
  StoreConfirmationPayload,
} from '@domain/procurement/purchase-order-fulfilment.models';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { extractApiErrorMessage } from '../requisitions/pr-status.helpers';

export interface PurchaseOrderFulfilmentState {
  overdue: OverdueOrderRow[];
  dispatches: PurchaseOrderDispatch[];
  confirmations: PurchaseOrderConfirmation[];
  reminders: PurchaseOrderReminder[];
  dropshipments: Dropshipment[];
  dropshipTotal: number;
  selectedDropship: Dropshipment | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
}

const initialState: PurchaseOrderFulfilmentState = {
  overdue: [],
  dispatches: [],
  confirmations: [],
  reminders: [],
  dropshipments: [],
  dropshipTotal: 0,
  selectedDropship: null,
  loading: false,
  busy: false,
  error: null,
};

/** Signal store of the Mod 046 fulfilment features. Mutating methods return the request so views can react. */
export const PurchaseOrderFulfilmentStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ overdue, confirmations }) => ({
    overdueCount: computed(() => overdue().length),
    latestConfirmation: computed(() => confirmations()[0] ?? null),
    confirmationsNeedingReview: computed(() => confirmations().filter((c) => c.requires_review).length),
  })),
  withMethods((store, api = inject(PurchaseOrderFulfilmentApiService)) => {
    /** Runs a read, keeping `loading` and `error` in sync; falls back to `fallback` on failure. */
    const read = <T>(source$: Observable<T>, fallback: T, onSuccess: (value: T) => void): Observable<T> => {
      patchState(store, { loading: true, error: null });
      return source$.pipe(
        tap(onSuccess),
        catchError((err: unknown) => {
          patchState(store, { error: extractApiErrorMessage(err) || String(err) });
          return of(fallback);
        }),
        finalize(() => patchState(store, { loading: false })),
      );
    };

    /** Runs a mutation, keeping `busy` in sync; errors are stored and rethrown to the caller. */
    const write = <T>(source$: Observable<T>, onSuccess: (value: T) => void): Observable<T> => {
      patchState(store, { busy: true, error: null });
      return source$.pipe(
        tap(onSuccess),
        catchError((err: unknown) => {
          patchState(store, { error: extractApiErrorMessage(err) || String(err) });
          throw err;
        }),
        finalize(() => patchState(store, { busy: false })),
      );
    };

    const replaceDropship = (updated: Dropshipment): void =>
      patchState(store, {
        selectedDropship: updated,
        dropshipments: store.dropshipments().map((d) => (d.id === updated.id ? updated : d)),
      });

    return {
      loadOverdue(): Observable<OverdueOrderRow[]> {
        return read(api.listOverdue(), [], (rows) => patchState(store, { overdue: rows }));
      },

      /** Sends the reminder of one order and refreshes its row (count, last reminder). */
      sendReminder(orderId: string): Observable<PurchaseOrderReminder> {
        return write(api.sendReminder(orderId), (reminder) =>
          patchState(store, {
            reminders: [reminder, ...store.reminders()],
            overdue: store
              .overdue()
              .map((row) =>
                row.order.id === orderId
                  ? { ...row, reminder_count: row.reminder_count + 1, last_reminder_at: reminder.sent_at }
                  : row,
              ),
          }),
        );
      },

      runReminders(): Observable<number> {
        return write(api.runReminders(), () => undefined);
      },

      loadReminders(orderId: string): Observable<PurchaseOrderReminder[]> {
        return read(api.listReminders(orderId), [], (rows) => patchState(store, { reminders: rows }));
      },

      loadDispatches(orderId: string): Observable<PurchaseOrderDispatch[]> {
        return read(api.listDispatches(orderId), [], (rows) => patchState(store, { dispatches: rows }));
      },

      dispatch(orderId: string, payload: DispatchPurchaseOrderPayload): Observable<PurchaseOrderDispatch> {
        return write(api.dispatch(orderId, payload), (row) =>
          patchState(store, { dispatches: [row, ...store.dispatches()] }),
        );
      },

      loadConfirmations(orderId: string): Observable<PurchaseOrderConfirmation[]> {
        return read(api.listConfirmations(orderId), [], (rows) => patchState(store, { confirmations: rows }));
      },

      recordConfirmation(orderId: string, payload: StoreConfirmationPayload): Observable<PurchaseOrderConfirmation> {
        return write(api.recordConfirmation(orderId, payload), (row) =>
          patchState(store, { confirmations: [row, ...store.confirmations()] }),
        );
      },

      loadDropshipments(filters?: DropshipFilters): Observable<Dropshipment[]> {
        return read(
          api.listDropshipments(filters).pipe(map((res) => ({ rows: res.data ?? [], total: res.meta?.total ?? (res.data ?? []).length }))),
          { rows: [] as Dropshipment[], total: 0 },
          ({ rows, total }) => patchState(store, { dropshipments: rows, dropshipTotal: total }),
        ).pipe(map(({ rows }) => rows));
      },

      loadDropshipment(id: string): Observable<Dropshipment | null> {
        return read<Dropshipment | null>(api.getDropshipment(id), null, (row) =>
          patchState(store, { selectedDropship: row }),
        );
      },

      createDropshipment(payload: CreateDropshipPayload): Observable<Dropshipment> {
        return write(api.createDropshipment(payload), (row) =>
          patchState(store, { dropshipments: [row, ...store.dropshipments()], selectedDropship: row }),
        );
      },

      issueDdt(id: string, payload: IssueDdtPayload): Observable<Dropshipment> {
        return write(api.issueDdt(id, payload), replaceDropship);
      },

      recordDelivery(id: string, payload: RecordDeliveryPayload): Observable<Dropshipment> {
        return write(api.recordDelivery(id, payload), replaceDropship);
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
