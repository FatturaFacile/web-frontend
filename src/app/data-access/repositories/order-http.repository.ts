import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env';
import { Order } from '@domain/models/order.model';
import { OrderRepository } from '@domain/repositories/order.repository';
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

  getOrderById(id: string): Observable<Order> {
    return this.http
      .get<{ data: SalesOrderApiDto }>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => OrderMapper.fromSalesOrder(res.data)));
  }
}
