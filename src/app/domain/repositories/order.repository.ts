import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Order } from '../models/order.model';

export interface OrderRepository {
  getOrders(): Observable<Order[]>;
  getOrderById(id: string): Observable<Order>;
}

export const ORDER_REPOSITORY = new InjectionToken<OrderRepository>('ORDER_REPOSITORY');
