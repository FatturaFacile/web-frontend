export interface OrderItemDto {
  item_id: string;
  prod_name: string;
  qty: number;
  price: number;
}

export interface OrderDto {
  order_id: string;
  ref_code: string;
  created_timestamp: string; // ISO String from backend
  items: OrderItemDto[];
  total: number;
}
