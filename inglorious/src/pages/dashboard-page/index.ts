import addressBook from "@iconify-icons/fa7-solid/address-book"
import arrowsRotate from "@iconify-icons/fa7-solid/arrows-rotate"
import boxesStacked from "@iconify-icons/fa7-solid/boxes-stacked"
import fileInvoice from "@iconify-icons/fa7-solid/file-invoice"
import qrcode from "@iconify-icons/fa7-solid/qrcode"
import inboxOutline from "@iconify-icons/material-symbols/inbox-outline"
import infoOutline from "@iconify-icons/material-symbols/info-outline"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { Icon, type IconData } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { LoadStatus } from "@inglorious/ui/load-status"
import { Table, type TableColumn, type TableProps } from "@inglorious/ui/table"
import { html, type TemplateResult } from "@inglorious/web"
import { pageRouteChange } from "@inglorious/web/router"

import type { AppApi, DashboardPageEntity } from "../../../types"
import { getKpiSummary } from "../../api/dashboard"
import { describeLoadFailure } from "../../api/http"
import { listInvoices } from "../../api/invoices"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatMoney } from "../../layout/format"
import { renderKpi } from "../../layout/kpi"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag, type TagColor } from "../../layout/tag"
import { contactDisplayName } from "../../models/contact"
import type { KpiSummary } from "../../models/dashboard"
import type { InvoiceResource } from "../../models/invoice"

const RECENT_INVOICES = 5
const FIRST_PAGE = 1
// Shown while the figures load, or when they failed to.
const NOTHING_YET = 0

const STATUS_COLORS: Record<string, TagColor> = {
  paid: "success",
  partially_paid: "info",
  issued: "info",
  overdue: "error",
}

const COLUMNS: TableColumn[] = [
  { id: "invoice_number", title: "DASHBOARD.COL_REF" },
  { id: "invoice_type", title: "DASHBOARD.COL_TYPE" },
  { id: "party", title: "DASHBOARD.COL_PARTY" },
  { id: "total", title: "DASHBOARD.COL_AMOUNT", align: "right" },
  { id: "status", title: "DASHBOARD.COL_STATUS" },
]

// Labels are translation keys.
const SHORTCUTS: {
  path: string
  label: string
  icon: IconData
  isMain?: boolean
}[] = [
  {
    path: "/sales/qr-bill",
    label: "DASHBOARD.BTN_QR",
    icon: qrcode,
    isMain: true,
  },
  { path: "/sales/invoices", label: "SALES.INVOICES.TITLE", icon: fileInvoice },
  { path: "/crm/clients", label: "DASHBOARD.BTN_CLIENTS", icon: addressBook },
  { path: "/inventory", label: "INVENTORY.TITLE", icon: boxesStacked },
]

interface DashboardData {
  kpi: KpiSummary | null
  invoices: InvoiceResource[]
}

const InvoiceTable = {
  ...Table,
  renderCell(
    props: TableProps,
    payload: {
      column: TableColumn
      row: Record<string, unknown>
      index: number
      columnIndex: number
    },
  ) {
    const invoice = payload.row as unknown as InvoiceResource
    const currency = String(props.currency)
    const content = renderInvoiceCell(payload.column.id, invoice, currency)
    return Table.renderCell(props, {
      ...payload,
      row: { ...payload.row, [payload.column.id]: content },
    })
  },
}

export const DashboardPage = [
  {
    routeChange: pageRouteChange<DashboardPageEntity & { id: string }>({
      open: (entity, _, api) => api.notify(`#${entity.id}:fetch`),
    }),

    ...handleAsync("fetch", {
      start(entity: DashboardPageEntity) {
        entity.isLoading = true
        entity.failure = null
      },

      // As in Angular, the figures may fail on their own: the list still shows.
      async run(): Promise<DashboardData> {
        const [kpi, invoices] = await Promise.allSettled([
          getKpiSummary(),
          listInvoices({ page: FIRST_PAGE, per_page: RECENT_INVOICES }),
        ])
        if (invoices.status === "rejected") throw invoices.reason
        return {
          kpi: kpi.status === "fulfilled" ? kpi.value.data : null,
          invoices: invoices.value.items,
        }
      },

      success(entity: DashboardPageEntity, { kpi, invoices }: DashboardData) {
        entity.kpi = kpi
        entity.invoices = invoices
      },

      error(entity: DashboardPageEntity, error: unknown) {
        entity.invoices = []
        entity.failure = describeLoadFailure(error)
      },

      finally(entity: DashboardPageEntity) {
        entity.isLoading = false
      },
    }),

    render(entity: DashboardPageEntity, api: AppApi): TemplateResult {
      const { jurisdiction, currency } = api.getEntity("workspace")!
      const { kpi } = entity
      const tenant = api.getEntity("session")!.user?.active_tenant

      return html`
        ${renderPageHeader(
          "DASHBOARD.TITLE",
          "DASHBOARD.SUBTITLE",
          tenant ? `${tenant.name} - ${tenant.country}` : undefined,
        )}
        ${Alert.render({
          severity: "info",
          className: "ff-dashboard-banner",
          icon: Icon.render({ icon: infoOutline }),
          title: html`${t("DASHBOARD.ACTIVE_REGIME")}
            <strong>${t(`DASHBOARD.REGIME_${jurisdiction}_LABEL`)}</strong>`,
          description: t("DASHBOARD.REGIME_DESC"),
        })}
        <div class="ff-kpis">
          ${renderKpi("DASHBOARD.KPI_REVENUE", formatMoney(kpi?.revenue_month ?? NOTHING_YET, currency), "primary")}
          ${renderKpi("DASHBOARD.KPI_PENDING", formatMoney(kpi?.open_receivables ?? NOTHING_YET, currency), "warning")}
          ${renderKpi("DASHBOARD.KPI_ORDERS", String(kpi?.pending_invoices_count ?? NOTHING_YET), "success")}
          ${renderKpi("DASHBOARD.KPI_COMPLIANCE", String(kpi?.active_alerts_count ?? NOTHING_YET), "accent")}
        </div>
        <div class="ff-dashboard-columns">
          ${Card.render({
            header: html`<div class="ff-card-header-row">
              <h2 class="iw-card-title">${t("DASHBOARD.RECENT_DOCS")}</h2>
              ${IconButton.render({
                icon: Icon.render({ icon: arrowsRotate }),
                ariaLabel: t("APP.RETRY"),
                variant: "ghost",
                size: "sm",
                isDisabled: entity.isLoading,
                onClick: () => api.notify(`#${entity.id}:fetch`),
              })}
            </div>`,
            children: LoadStatus.render({
              isLoading: entity.isLoading,
              loadingLabel: t("APP.LOADING"),
              isError: Boolean(entity.failure),
              error: entity.failure
                ? Alert.render({
                    severity: "error",
                    description: t(entity.failure),
                  })
                : "",
              // The columns show even with no rows, as in the Angular table.
              content: () =>
                html`${InvoiceTable.render({
                  columns: COLUMNS.map((column) => ({
                    ...column,
                    label: t(String(column.title)),
                  })),
                  rows: entity.invoices as unknown as Record<string, unknown>[],
                  currency,
                  isFullWidth: true,
                })}
                ${
                  entity.invoices.length
                    ? ""
                    : html`<p class="ff-empty-state">
                        ${Icon.render({ icon: inboxOutline, size: "lg" })}
                        ${t("APP.EMPTY")}
                      </p>`
                }`,
            }),
          })}
          ${Card.render({
            title: t("DASHBOARD.SHOWCASE_TITLE"),
            children: html`<nav
              class="ff-shortcuts"
              aria-label=${t("DASHBOARD.SHOWCASE_TITLE")}
            >
              ${SHORTCUTS.map((shortcut) =>
                Button.render({
                  href: shortcut.path,
                  color: shortcut.isMain ? "primary" : "default",
                  variant: shortcut.isMain ? "default" : "outline",
                  isFullWidth: true,
                  className: "ff-shortcut",
                  children: html`${Icon.render({ icon: shortcut.icon })}
                  ${t(shortcut.label)}`,
                }),
              )}
            </nav>`,
          })}
        </div>
      `
    },
  },
  requireAuth,
]

function renderInvoiceCell(
  columnId: string,
  invoice: InvoiceResource,
  fallbackCurrency: string,
): TemplateResult | string {
  switch (columnId) {
    case "invoice_number":
      return html`<strong>${invoice.invoice_number}</strong>
        ${invoice.has_swiss_qr ? renderTag("QR", "error") : ""}`
    case "invoice_type":
      return invoice.invoice_type ?? ""
    case "party": {
      const contact = invoice.client ?? invoice.contact
      return contact ? contactDisplayName(contact) : "-"
    }
    case "total":
      return html`<strong
        >${formatMoney(invoice.total, invoice.currency || fallbackCurrency)}</strong
      >`
    case "status": {
      const status = invoice.payment_status ?? invoice.status
      return renderTag(status, STATUS_COLORS[status] ?? "default")
    }
    default:
      return ""
  }
}

export default DashboardPage
