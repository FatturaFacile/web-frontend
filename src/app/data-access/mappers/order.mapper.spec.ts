import { describe, expect, it } from 'vitest';
import { OrderDto } from '../dtos/order.dto';
import { Order } from '@domain/models/order.model';
import { OrderMapper } from './order.mapper';

describe('OrderMapper', () => {
  const sampleDto: OrderDto = {
    order_id: 'ord-123',
    ref_code: 'REF-2026-001',
    created_timestamp: '2026-05-15T14:30:00.000Z',
    total: 350.5,
    items: [
      {
        item_id: 'item-1',
        prod_name: 'Consulting Service',
        qty: 2,
        price: 150.0,
      },
      {
        item_id: 'item-2',
        prod_name: 'License Fee',
        qty: 1,
        price: 50.5,
      },
    ],
  };

  const sampleDomainModel: Order = {
    id: 'ord-123',
    referenceNumber: 'REF-2026-001',
    createdAt: new Date('2026-05-15T14:30:00.000Z'),
    totalAmount: 350.5,
    items: [
      {
        id: 'item-1',
        productName: 'Consulting Service',
        quantity: 2,
        unitPrice: 150.0,
      },
      {
        id: 'item-2',
        productName: 'License Fee',
        quantity: 1,
        unitPrice: 50.5,
      },
    ],
  };

  describe('toDomain', () => {
    it('should map full OrderDto to Order domain model correctly', () => {
      const result = OrderMapper.toDomain(sampleDto);

      expect(result.id).toBe('ord-123');
      expect(result.referenceNumber).toBe('REF-2026-001');
      expect(result.createdAt.toISOString()).toBe('2026-05-15T14:30:00.000Z');
      expect(result.totalAmount).toBe(350.5);
      expect(result.items.length).toBe(2);
      expect(result.items[0]).toEqual({
        id: 'item-1',
        productName: 'Consulting Service',
        quantity: 2,
        unitPrice: 150.0,
      });
    });

    it('should handle empty items array gracefully', () => {
      const dtoWithEmptyItems: OrderDto = {
        ...sampleDto,
        items: [],
      };

      const result = OrderMapper.toDomain(dtoWithEmptyItems);
      expect(result.items).toEqual([]);
    });

    it('should fallback to empty array if items property is undefined/null in DTO', () => {
      const dtoWithNullItems = {
        ...sampleDto,
        items: undefined as unknown as OrderDto['items'],
      };

      const result = OrderMapper.toDomain(dtoWithNullItems);
      expect(result.items).toEqual([]);
    });
  });

  describe('toDto', () => {
    it('should map Order domain model to OrderDto correctly', () => {
      const result = OrderMapper.toDto(sampleDomainModel);

      expect(result.order_id).toBe('ord-123');
      expect(result.ref_code).toBe('REF-2026-001');
      expect(result.created_timestamp).toBe('2026-05-15T14:30:00.000Z');
      expect(result.total).toBe(350.5);
      expect(result.items.length).toBe(2);
      expect(result.items[1]).toEqual({
        item_id: 'item-2',
        prod_name: 'License Fee',
        qty: 1,
        price: 50.5,
      });
    });

    it('should round-trip cleanly between toDomain and toDto', () => {
      const domain = OrderMapper.toDomain(sampleDto);
      const dto = OrderMapper.toDto(domain);

      expect(dto).toEqual(sampleDto);
    });
  });
});
