export interface ProductItem {
  id: string
  sku: string
  name: string
  description?: string
  warehouse: string
  quantity: number
  unit_of_measure: string
  hs_code?: string
  price: number
  currency: "EUR" | "CHF"
  tax_rate?: number
  status?: "in_stock" | "low_stock" | "out_of_stock"
  created_at?: string
  updated_at?: string
}

export type CreateProductPayload = Omit<
  ProductItem,
  "id" | "status" | "created_at" | "updated_at"
>
