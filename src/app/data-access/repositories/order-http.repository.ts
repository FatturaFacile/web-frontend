import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Order } from '@domain/models/order.model';
import { OrderRepository } from '@domain/repositories/order.repository';
import { OrderDto } from '../dtos/order.dto';
import { OrderMapper } from '../mappers/order.mapper';

@Injectable()
export class OrderHttpRepository implements OrderRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/orders';

  getOrders(): Observable<Order[]> {
    return this.http
      .get<OrderDto[]>(this.baseUrl)
      .pipe(map((dtos) => dtos.map((dto) => OrderMapper.toDomain(dto))));
  }

  getOrderById(id: string): Observable<Order> {
    return this.http
      .get<OrderDto>(`${this.baseUrl}/${id}`)
      .pipe(map((dto) => OrderMapper.toDomain(dto)));
  }
}
