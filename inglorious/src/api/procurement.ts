import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import type {
  CreatePurchaseOrderPayload,
  ProcurementSupplier,
  PurchaseOrder,
  PurchaseOrderTransition,
} from "../models/procurement"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/procurement"

export async function listPurchaseOrders(
  query: ListQuery,
): Promise<Page<PurchaseOrder>> {
  return toPage(
    await http.get<ListResponse<PurchaseOrder>>(
      `${PATH}/purchase-orders`,
      query,
    ),
  )
}

export async function listSuppliers(): Promise<ProcurementSupplier[]> {
  return toPage(
    await http.get<ListResponse<ProcurementSupplier>>(`${PATH}/suppliers`),
  ).items
}

export const createPurchaseOrder = (payload: CreatePurchaseOrderPayload) =>
  http.post<ApiResponse<PurchaseOrder>>(`${PATH}/purchase-orders`, payload)

export const deletePurchaseOrder = (id: string) =>
  http.delete<ApiResponse<unknown>>(`${PATH}/purchase-orders/${id}`)

/** Moves an order along its approval workflow; a rejection says why. */
export const transitionPurchaseOrder = (
  id: string,
  transition: PurchaseOrderTransition,
  reason?: string,
) =>
  http.post<ApiResponse<PurchaseOrder>>(
    `${PATH}/purchase-orders/${id}/${transition}`,
    reason ? { reason } : {},
  )
