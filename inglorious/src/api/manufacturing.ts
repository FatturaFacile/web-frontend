import type { ListResponse } from "../models/api"
import type { ProductionOrder } from "../models/manufacturing"
import { http } from "./http"
import { toPage } from "./page"

export async function listProductionOrders(): Promise<ProductionOrder[]> {
  return toPage(
    await http.get<ListResponse<ProductionOrder>>(
      "/manufacturing/production-orders",
    ),
  ).items
}
