import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env';
import { toHttpParams } from '@core/http/laravel-http.utils';
import { Order } from '@domain/models/order.model';
import { OrderColumnValue, OrderPage, OrderRepository } from '@domain/repositories/order.repository';
import { SalesOrderApiDto } from '../dtos/sales-order.dto';
import { OrderMapper } from '../mappers/order.mapper';

/** Order history over the sales orders of the API (`/sales/orders`). */
@Injectable()
export class OrderHttpRepository implements OrderRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/sales/orders`;

  getOrders(): Observable<Order[]> {
    return this.http
      .get<{ data: SalesOrderApiDto[] }>(this.baseUrl, { params: { per_page: 100 } })
      .pipe(map((res) => (res.data ?? []).map((dto) => OrderMapper.fromSalesOrder(dto))));
  }

  getOrdersPage(query: Record<string, unknown>): Observable<OrderPage> {
    return this.http
      .get<OrderPage<SalesOrderApiDto>>(this.baseUrl, { params: toHttpParams(query) })
      .pipe(map((res) => ({ ...res, data: (res.data ?? []).map((dto) => OrderMapper.fromSalesOrder(dto)) })));
  }

  getOrderColumnValues(query: Record<string, unknown>): Observable<OrderPage<OrderColumnValue>> {
    return this.http.get<OrderPage<OrderColumnValue>>(this.baseUrl, { params: toHttpParams(query) });
  }

  getOrderById(id: string): Observable<Order> {
    return this.http
      .get<{ data: SalesOrderApiDto }>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => OrderMapper.fromSalesOrder(res.data)));
  }
}
