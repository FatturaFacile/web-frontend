import { type Order, type OrderDto, toOrder } from "../models/order"
import { http } from "./http"

/** The endpoint answers with a bare array, without the usual envelope. */
export async function listOrders(): Promise<Order[]> {
  const orders = await http.get<OrderDto[]>("/orders")
  return orders.map(toOrder)
}
