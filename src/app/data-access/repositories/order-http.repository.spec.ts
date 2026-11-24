import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { environment } from '@env';
import { SalesOrderApiDto } from '@data-access/dtos/sales-order.dto';
import { OrderHttpRepository } from '@data-access/repositories/order-http.repository';

describe('OrderHttpRepository', () => {
  let repository: OrderHttpRepository;
  let httpMock: HttpTestingController;

  const mockDtos: SalesOrderApiDto[] = [
    {
      id: 'ord-1',
      order_number: 'SO-001',
      date: '2026-01-01',
      created_at: '2026-01-01T10:00:00.000Z',
      total_gross: '100.00',
      items: [{ id: 'i-1', description: 'Widget A', quantity: '2.0000', unit_price: '50.00' }],
    },
    {
      id: 'ord-2',
      order_number: 'SO-002',
      date: '2026-01-02',
      created_at: '2026-01-02T12:00:00.000Z',
      total_gross: '150.00',
      items: [{ id: 'i-2', description: 'Widget B', quantity: '1.0000', unit_price: '150.00' }],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OrderHttpRepository,
      ],
    });

    repository = TestBed.inject(OrderHttpRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch orders via GET and map them to domain models', () => {
    repository.getOrders().subscribe({
      next: (orders) => {
        expect(orders.length).toBe(2);
        expect(orders[0].id).toBe('ord-1');
        expect(orders[0].referenceNumber).toBe('SO-001');
        expect(orders[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
        expect(orders[0].totalAmount).toBe(100);
        expect(orders[0].items[0].productName).toBe('Widget A');
      },
    });

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/sales/orders`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('per_page')).toBe('100');
    req.flush({ data: mockDtos });
  });

  it('should fetch single order by id via GET and map to domain model', () => {
    repository.getOrderById('ord-1').subscribe({
      next: (order) => {
        expect(order.id).toBe('ord-1');
        expect(order.referenceNumber).toBe('SO-001');
        expect(order.totalAmount).toBe(100);
      },
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/sales/orders/ord-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockDtos[0] });
  });

  it('should propagate HTTP errors when getOrders fails', () => {
    let errorStatus = 0;

    repository.getOrders().subscribe({
      next: () => {
        throw new Error('should not succeed');
      },
      error: (err) => {
        errorStatus = err.status;
      },
    });

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/sales/orders`);
    req.flush('Failed to fetch', { status: 500, statusText: 'Internal Server Error' });

    expect(errorStatus).toBe(500);
  });
});
