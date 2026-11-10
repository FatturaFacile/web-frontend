import { Order, OrderItem } from '@domain/models/order.model';
import { OrderDto, OrderItemDto } from '../dtos/order.dto';
import { SalesOrderApiDto } from '../dtos/sales-order.dto';

export class OrderMapper {
  /**
   * Maps a sales order of the API. The domain model keeps numeric amounts for display, so the decimal
   * strings are converted here and nowhere else.
   */
  static fromSalesOrder(dto: SalesOrderApiDto): Order {
    return {
      id: dto.id,
      referenceNumber: dto.order_number,
      createdAt: new Date(dto.created_at ?? dto.date),
      items: (dto.items ?? []).map((item) => ({
        id: item.id,
        productName: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
      })),
      totalAmount: Number(dto.total_gross),
    };
  }

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
