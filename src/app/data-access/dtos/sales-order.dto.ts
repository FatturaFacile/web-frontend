/** Subset of a sales order as returned by `GET /sales/orders` (amounts are decimal strings). */
export interface SalesOrderItemApiDto {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

export interface SalesOrderApiDto {
  id: string;
  order_number: string;
  date: string;
  created_at?: string | null;
  total_gross: string;
  items?: SalesOrderItemApiDto[];
  items_count?: number;
}
