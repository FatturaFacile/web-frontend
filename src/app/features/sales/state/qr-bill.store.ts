import { computed, inject } from '@angular/core';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { QrBill } from '@domain/models/qr-bill.model';
import { QR_BILL_REPOSITORY } from '@domain/repositories/qr-bill.repository';

export interface QrBillState {
  bills: QrBill[];
  selectedBill: QrBill | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: QrBillState = {
  bills: [],
  selectedBill: null,
  isLoading: false,
  error: null,
};

export const QrBillStore = signalStore(
  withState(initialState),
  withComputed(({ bills, selectedBill }) => ({
    billsCount: computed(() => bills().length),
    totalChfRevenue: computed(() =>
      bills()
        .filter((b) => b.currency === 'CHF')
        .reduce((sum, b) => sum + b.amount, 0)
    ),
    pendingBillsCount: computed(
      () => bills().filter((b) => b.status === 'PENDING').length
    ),
    currentBill: computed(() => selectedBill() ?? bills()[0] ?? null),
  })),
  withMethods((store, repository = inject(QR_BILL_REPOSITORY)) => ({
    setSelectedBill(selectedBill: QrBill | null): void {
      patchState(store, { selectedBill });
    },
    loadBills: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          repository.getBills().pipe(
            tap((bills) => {
              patchState(store, {
                bills,
                isLoading: false,
                selectedBill: bills[0] ?? null,
              });
            }),
            catchError((err: Error) => {
              patchState(store, { error: err.message, isLoading: false });
              return of([] as QrBill[]);
            })
          )
        )
      )
    ),
    addBill(newBill: QrBill): void {
      patchState(store, (state) => ({
        bills: [newBill, ...state.bills],
        selectedBill: newBill,
      }));
    },
  }))
);
