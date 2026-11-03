/** An order as `GET /orders` sends it. */
export interface OrderDto {
  order_id: string
  ref_code: string
  /** ISO 8601. */
  created_timestamp: string
  items: OrderItemDto[]
  total: number
}

export interface OrderItemDto {
  item_id: string
  prod_name: string
  qty: number
  price: number
}

/** An order as the app uses it. Dates stay ISO strings: state holds no `Date`. */
export interface Order {
  id: string
  referenceNumber: string
  createdAt: string
  items: OrderItem[]
  totalAmount: number
}

export interface OrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
}

export function toOrder(dto: OrderDto): Order {
  return {
    id: dto.order_id,
    referenceNumber: dto.ref_code,
    createdAt: dto.created_timestamp,
    items: (dto.items ?? []).map((item) => ({
      id: item.item_id,
      productName: item.prod_name,
      quantity: item.qty,
      unitPrice: item.price,
    })),
    totalAmount: dto.total,
  }
}
