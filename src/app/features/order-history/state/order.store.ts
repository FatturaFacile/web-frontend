import { computed, inject } from '@angular/core';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Order } from '@domain/models/order.model';
import { ORDER_REPOSITORY } from '@domain/repositories/order.repository';

export interface OrderState {
  orders: Order[];
  selectedOrderId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const initialOrderState: OrderState = {
  orders: [],
  selectedOrderId: null,
  isLoading: false,
  error: null,
};

export const OrderStore = signalStore(
  withState(initialOrderState),
  withComputed(({ orders, selectedOrderId }) => ({
    ordersCount: computed(() => orders().length),
    selectedOrder: computed(() => orders().find((o) => o.id === selectedOrderId()) ?? null),
    totalRevenue: computed(() => orders().reduce((sum, order) => sum + order.totalAmount, 0)),
  })),
  withMethods((store, repository = inject(ORDER_REPOSITORY)) => ({
    setSelectedOrderId(selectedOrderId: string | null): void {
      patchState(store, { selectedOrderId });
    },
    loadOrders: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          repository.getOrders().pipe(
            tap((orders) => patchState(store, { orders, isLoading: false })),
            catchError((err: Error) => {
              patchState(store, { error: err.message, isLoading: false });
              return of([] as Order[]);
            })
          )
        )
      )
    ),
  }))
);
