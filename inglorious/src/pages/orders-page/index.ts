import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AppApi,
  OrderRow,
  OrdersGridEntity,
  OrdersPageEntity,
} from "../../../types"
import { listOrders } from "../../api/orders"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDateTime, formatMoney } from "../../layout/format"
import { renderKpi } from "../../layout/kpi"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag } from "../../layout/tag"
import type { Order } from "../../models/order"
import { withCells } from "../../types/grid-cells"
import { createLoadedDataGrid } from "../../types/loaded-data-grid"

// The Angular order history showed every amount in euros.
const CURRENCY = "EUR"
const NO_REVENUE = 0

interface OrdersGridProps extends DataGridProps<OrderRow> {
  onSelect?: (rowId: string) => void
}

export const OrdersGrid = {
  ...createLoadedDataGrid(listOrders, toOrderRow),

  ...withCells(renderOrderCell, (entity: OrdersGridEntity, api: AppApi) => ({
    // The grid selects a row on a click only: a button selects it from the keyboard too.
    onSelect: (rowId: string) =>
      api.notify(`#${entity.id}:rowClick`, { rowId }),
  })),
}

export const OrdersPage = [
  {
    routeChange: pageRouteChange<OrdersPageEntity & { id: string }>({
      open: (entity, _, api) => api.notify(`#${entity.gridId}:fetch`),
    }),

    render(entity: OrdersPageEntity, api: AppApi): TemplateResult {
      const grid = api.getEntity(entity.gridId) as OrdersGridEntity
      const revenue = grid.rows.reduce(
        (sum, row) => sum + row.totalAmount,
        NO_REVENUE,
      )
      const [selectedId] = grid.selection
      const selected = grid.rows.find((row) => row.id === selectedId)

      return html`
        ${renderPageHeader("ORDERS.TITLE", "ORDERS.SUBTITLE")}
        <div class="ff-kpis">
          ${renderKpi("ORDERS.COUNT", grid.rows.length)}
          ${renderKpi("ORDERS.REVENUE", formatMoney(revenue, CURRENCY))}
        </div>
        ${when(grid.failure, () =>
          Alert.render({
            severity: "error",
            description: t(grid.failure!),
            action: Button.render({
              size: "sm",
              children: t("APP.RETRY"),
              onClick: () => api.notify(`#${entity.gridId}:fetch`),
            }),
          }),
        )}
        ${Card.render({ children: api.render(entity.gridId) })}
        ${when(selected, () => renderDetail(selected!))}
      `
    },
  },
  requireAuth,
]

function toOrderRow(order: Order): OrderRow {
  return { ...order, itemsCount: order.items.length }
}

function renderOrderCell(
  props: OrdersGridProps,
  columnId: string,
  row: OrderRow,
): TemplateResult | string | typeof nothing {
  switch (columnId) {
    case "referenceNumber":
      return renderTag(row.referenceNumber, "info")
    case "createdAt":
      return formatDateTime(row.createdAt)
    case "totalAmount":
      return html`<strong>${formatMoney(row.totalAmount, CURRENCY)}</strong>`
    case "actions":
      return Button.render({
        size: "sm",
        variant: "outline",
        isPressed: props.selection.includes(row.id),
        children: t("COMMON.SELECT"),
        onClick: (event: MouseEvent) => {
          event.stopPropagation()
          props.onSelect?.(row.id)
        },
      })
    default:
      return nothing
  }
}

function renderDetail(order: OrderRow): TemplateResult {
  return Card.render({
    title: t("ORDERS.SELECTED_TITLE"),
    className: "ff-detail-card",
    children: html`<dl class="ff-detail-list">
        <dt>ID</dt>
        <dd>${order.id}</dd>
        <dt>${t("ORDERS.COL_REF")}</dt>
        <dd>${order.referenceNumber}</dd>
        <dt>${t("COMMON.TOTAL")}</dt>
        <dd>${formatMoney(order.totalAmount, CURRENCY)}</dd>
      </dl>
      <h3 class="ff-detail-heading">${t("ORDERS.ITEMS_LABEL")}</h3>
      <ul>
        ${order.items.map(
          (item) =>
            html`<li>
              ${item.productName} - ${item.quantity} ×
              ${formatMoney(item.unitPrice, CURRENCY)}
            </li>`,
        )}
      </ul>`,
  })
}

export default OrdersPage
