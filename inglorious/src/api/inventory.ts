import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import type { CreateProductPayload, ProductItem } from "../models/inventory"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/inventory/products"

export async function listProducts(
  query: ListQuery,
): Promise<Page<ProductItem>> {
  return toPage(await http.get<ListResponse<ProductItem>>(PATH, query))
}

export const createProduct = (payload: CreateProductPayload) =>
  http.post<ApiResponse<ProductItem>>(PATH, payload)

export const deleteProduct = (id: string) =>
  http.delete<ApiResponse<unknown>>(`${PATH}/${id}`)
