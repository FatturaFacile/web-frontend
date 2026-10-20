import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { Order } from '@domain/models/order.model';
import { ORDER_REPOSITORY, OrderRepository } from '@domain/repositories/order.repository';
import { OrderStore } from './order.store';

describe('OrderStore', () => {
  let store: InstanceType<typeof OrderStore>;
  let mockRepository: {
    getOrders: ReturnType<typeof vi.fn>;
    getOrderById: ReturnType<typeof vi.fn>;
  };

  const mockOrders: Order[] = [
    {
      id: 'ord-1',
      referenceNumber: 'REF-001',
      createdAt: new Date('2026-01-01T10:00:00Z'),
      items: [{ id: 'item-1', productName: 'Widget A', quantity: 2, unitPrice: 50 }],
      totalAmount: 100,
    },
    {
      id: 'ord-2',
      referenceNumber: 'REF-002',
      createdAt: new Date('2026-01-02T12:00:00Z'),
      items: [{ id: 'item-2', productName: 'Widget B', quantity: 1, unitPrice: 150 }],
      totalAmount: 150,
    },
  ];

  beforeEach(() => {
    mockRepository = {
      getOrders: vi.fn(),
      getOrderById: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        OrderStore,
        { provide: ORDER_REPOSITORY, useValue: mockRepository as unknown as OrderRepository },
      ],
    });

    store = TestBed.inject(OrderStore);
  });

  it('should initialize with default state and computed signals', () => {
    expect(store.orders()).toEqual([]);
    expect(store.ordersCount()).toBe(0);
    expect(store.selectedOrderId()).toBeNull();
    expect(store.selectedOrder()).toBeNull();
    expect(store.totalRevenue()).toBe(0);
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('should update selectedOrderId and resolve selectedOrder computed signal', () => {
    mockRepository.getOrders.mockReturnValue(of(mockOrders));
    store.loadOrders();

    store.setSelectedOrderId('ord-2');

    expect(store.selectedOrderId()).toBe('ord-2');
    expect(store.selectedOrder()).toEqual(mockOrders[1]);
  });

  it('should load orders successfully and calculate total revenue', () => {
    mockRepository.getOrders.mockReturnValue(of(mockOrders));

    store.loadOrders();

    expect(mockRepository.getOrders).toHaveBeenCalledTimes(1);
    expect(store.isLoading()).toBe(false);
    expect(store.orders()).toEqual(mockOrders);
    expect(store.ordersCount()).toBe(2);
    expect(store.totalRevenue()).toBe(250);
    expect(store.error()).toBeNull();
  });

  it('should handle repository errors gracefully', () => {
    const errorMessage = 'Network error fetching orders';
    mockRepository.getOrders.mockReturnValue(throwError(() => new Error(errorMessage)));

    store.loadOrders();

    expect(mockRepository.getOrders).toHaveBeenCalledTimes(1);
    expect(store.isLoading()).toBe(false);
    expect(store.orders()).toEqual([]);
    expect(store.error()).toBe(errorMessage);
  });
});
