import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Order } from '../models/order.model';

/** One page of orders, or (when the query asks for `grid_values`) the distinct values of a column with their counts. */
export interface OrderPage<TRow = Order> {
  readonly data: readonly TRow[];
  readonly meta: {
    readonly current_page: number;
    readonly last_page: number;
    readonly per_page: number;
    readonly total: number;
  };
}

export interface OrderColumnValue {
  readonly value: string | null;
  readonly count: number;
}

export interface OrderRepository {
  getOrders(): Observable<Order[]>;
  /** A page of orders; paging, sorting, filtering and grouping are decided by the server (grid query contract). */
  getOrdersPage(query: Record<string, unknown>): Observable<OrderPage>;
  /** The distinct values of a column over the whole dataset (the lists a column filter offers). */
  getOrderColumnValues(query: Record<string, unknown>): Observable<OrderPage<OrderColumnValue>>;
  getOrderById(id: string): Observable<Order>;
}

export const ORDER_REPOSITORY = new InjectionToken<OrderRepository>('ORDER_REPOSITORY');
