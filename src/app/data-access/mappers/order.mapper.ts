import { Order, OrderItem } from '@domain/models/order.model';
import { OrderDto, OrderItemDto } from '../dtos/order.dto';

export class OrderMapper {
  static toDomain(dto: OrderDto): Order {
    return {
      id: dto.order_id,
      referenceNumber: dto.ref_code,
      createdAt: new Date(dto.created_timestamp),
      items: (dto.items ?? []).map(this.mapItemToDomain),
      totalAmount: dto.total,
    };
  }

  static toDto(model: Order): OrderDto {
    return {
      order_id: model.id,
      ref_code: model.referenceNumber,
      created_timestamp: model.createdAt.toISOString(),
      items: model.items.map(this.mapItemToDto),
      total: model.totalAmount,
    };
  }

  private static mapItemToDomain(itemDto: OrderItemDto): OrderItem {
    return {
      id: itemDto.item_id,
      productName: itemDto.prod_name,
      quantity: itemDto.qty,
      unitPrice: itemDto.price,
    };
  }

  private static mapItemToDto(item: OrderItem): OrderItemDto {
    return {
      item_id: item.id,
      prod_name: item.productName,
      qty: item.quantity,
      price: item.unitPrice,
    };
  }
}
