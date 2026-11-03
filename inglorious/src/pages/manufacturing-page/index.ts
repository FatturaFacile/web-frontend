import { html } from "@inglorious/web"

import { listProductionOrders } from "../../api/manufacturing"
import { renderTag } from "../../layout/tag"
import type { ProductionOrder } from "../../models/manufacturing"
import { createListPage } from "../../types/list-page"

export const ManufacturingPage = createListPage(
  listProductionOrders,
  (columnId, order: ProductionOrder) => {
    switch (columnId) {
      case "num":
      case "qty":
        return html`<strong>${order[columnId]}</strong>`
      case "progress":
        return renderTag(order.progress, "info")
      case "qa":
        return renderTag(order.qa, "success")
    }
  },
)

export default ManufacturingPage
