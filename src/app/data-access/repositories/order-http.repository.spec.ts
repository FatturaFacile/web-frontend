import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { OrderDto } from '../dtos/order.dto';
import { OrderHttpRepository } from './order-http.repository';

describe('OrderHttpRepository', () => {
  let repository: OrderHttpRepository;
  let httpMock: HttpTestingController;

  const mockDtos: OrderDto[] = [
    {
      order_id: 'ord-1',
      ref_code: 'REF-001',
      created_timestamp: '2026-01-01T10:00:00.000Z',
      items: [{ item_id: 'i-1', prod_name: 'Widget A', qty: 2, price: 50 }],
      total: 100,
    },
    {
      order_id: 'ord-2',
      ref_code: 'REF-002',
      created_timestamp: '2026-01-02T12:00:00.000Z',
      items: [{ item_id: 'i-2', prod_name: 'Widget B', qty: 1, price: 150 }],
      total: 150,
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
        expect(orders[0].referenceNumber).toBe('REF-001');
        expect(orders[0].createdAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
        expect(orders[0].totalAmount).toBe(100);
        expect(orders[0].items[0].productName).toBe('Widget A');
      },
    });

    const req = httpMock.expectOne('/api/orders');
    expect(req.request.method).toBe('GET');
    req.flush(mockDtos);
  });

  it('should fetch single order by id via GET and map to domain model', () => {
    repository.getOrderById('ord-1').subscribe({
      next: (order) => {
        expect(order.id).toBe('ord-1');
        expect(order.referenceNumber).toBe('REF-001');
        expect(order.totalAmount).toBe(100);
      },
    });

    const req = httpMock.expectOne('/api/orders/ord-1');
    expect(req.request.method).toBe('GET');
    req.flush(mockDtos[0]);
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

    const req = httpMock.expectOne('/api/orders');
    req.flush('Failed to fetch', { status: 500, statusText: 'Internal Server Error' });

    expect(errorStatus).toBe(500);
  });
});
