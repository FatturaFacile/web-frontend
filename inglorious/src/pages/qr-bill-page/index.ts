import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Input } from "@inglorious/ui/input"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type { AppApi, QrBillGridEntity, QrBillPageEntity } from "../../../types"
import { listQrBills } from "../../api/qr-bills"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDate, formatDecimal, formatMoney } from "../../layout/format"
import { renderKpi } from "../../layout/kpi"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag, type TagColor } from "../../layout/tag"
import {
  formatScor,
  type QrBill,
  type QrBillAddress,
  type QrBillStatus,
  roundSwissAmount,
} from "../../models/qr-bill"
import { type CellContent, withCells } from "../../types/grid-cells"
import { createLoadedDataGrid } from "../../types/loaded-data-grid"

const NONE = 0
const CHF = "CHF"

const STATUS_TAGS: Record<QrBillStatus, { key: string; color: TagColor }> = {
  PAID: { key: "SWISS_QR.STATUS_PAID", color: "success" },
  PENDING: { key: "SWISS_QR.STATUS_PENDING", color: "warning" },
  DRAFT: { key: "SWISS_QR.STATUS_DRAFT", color: "default" },
  CANCELLED: { key: "SALES.INVOICES.STATUS.CANCELLED", color: "error" },
}

interface QrBillGridProps extends DataGridProps<QrBill> {
  /** The bill the preview shows. */
  currentId?: string | null
  onSelect?: (rowId: string) => void
}

export const QrBillGrid = {
  ...createLoadedDataGrid(listQrBills, (bill: QrBill) => bill),

  ...withCells(
    (props: QrBillGridProps, columnId, bill: QrBill): CellContent => {
      switch (columnId) {
        case "billNumber":
          return html`<strong>${bill.billNumber}</strong>`
        case "debtor":
          return bill.debtor.name
        case "amount":
          return formatMoney(bill.amount, bill.currency)
        case "dueDate":
          return formatDate(bill.dueDate)
        case "status": {
          const { key, color } = STATUS_TAGS[bill.status] ?? STATUS_TAGS.DRAFT
          return renderTag(t(key), color)
        }
        case "actions":
          return Button.render({
            size: "sm",
            variant: "outline",
            isPressed: props.currentId === bill.id,
            ariaLabel: `${t("COMMON.PREVIEW")}: ${bill.billNumber}`,
            children: t("COMMON.PREVIEW"),
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              props.onSelect?.(bill.id)
            },
          })
        default:
          return nothing
      }
    },
    (entity: QrBillGridEntity, api: AppApi) => ({
      currentId: currentBill(entity)?.id ?? null,
      // The grid selects a row on a click only: a button selects it from the keyboard too.
      onSelect: (rowId: string) =>
        api.notify(`#${entity.id}:rowClick`, { rowId }),
    }),
  ),
}

/**
 * The QR-bills issued, with a preview of a bill's payment part and a 0.05 CHF
 * rounding calculator.
 *
 * The Angular page also had a form that "generated" a bill: it never reached
 * the server, and made up the bill's number, QR reference and creditor. A
 * QR-bill comes from a Swiss invoice (its "Generate QR-Bill" action), so this
 * page points there instead.
 */
export const QrBillPage = [
  {
    routeChange: pageRouteChange<QrBillPageEntity & { id: string }>({
      open: (entity, _, api) => api.notify(`#${entity.gridId}:fetch`),
    }),

    rawAmountChange(entity: QrBillPageEntity, value: string) {
      entity.rawAmount = value
    },

    render(entity: QrBillPageEntity, api: AppApi): TemplateResult {
      const grid = api.getEntity(entity.gridId) as QrBillGridEntity
      const bills = grid.rows
      const revenue = bills
        .filter((bill) => bill.currency === CHF)
        .reduce((sum, bill) => sum + bill.amount, NONE)
      const pending = bills.filter((bill) => bill.status === "PENDING").length
      const current = currentBill(grid)

      return html`
        ${renderPageHeader("SWISS_QR.TITLE", "SWISS_QR.SUBTITLE")}
        <div class="ff-kpis">
          ${renderKpi("SWISS_QR.TOTAL_BILLS", bills.length)}
          ${renderKpi("SWISS_QR.TOTAL_REVENUE", formatMoney(revenue, CHF), "success")}
          ${renderKpi("SWISS_QR.PENDING_COLLECTION", pending, "warning")}
        </div>
        ${Alert.render({
          severity: "info",
          description: t("SWISS_QR.FROM_INVOICES"),
          action: Button.render({
            size: "sm",
            href: "/sales/invoices",
            children: t("SWISS_QR.OPEN_INVOICES"),
          }),
        })}
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
        <div class="ff-qr-layout">
          <div class="ff-qr-column">
            ${Card.render({
              title: t("SWISS_QR.LIST_TITLE"),
              children: api.render(entity.gridId),
            })}
            ${renderRounding(entity, api)}
          </div>
          ${when(current, () => renderVoucher(current!))}
        </div>
      `
    },
  },
  requireAuth,
]

// The preview shows the bill picked, or the first one.
function currentBill(grid: QrBillGridEntity): QrBill | undefined {
  const [selectedId] = grid.selection
  return grid.rows.find((bill) => bill.id === selectedId) ?? grid.rows[NONE]
}

function renderRounding(entity: QrBillPageEntity, api: AppApi): TemplateResult {
  const raw = Number(entity.rawAmount) || NONE
  const rounded = roundSwissAmount(raw)
  const decimals = (amount: number) => `${formatDecimal(amount)} ${CHF}`

  return Card.render({
    title: t("SWISS_QR.ROUNDING_TITLE"),
    children: html`${Input.render({
        id: `${entity.id}-raw-amount`,
        label: t("SWISS_QR.RAW_AMOUNT_LABEL"),
        inputType: "number",
        min: 0,
        step: 0.01,
        value: entity.rawAmount,
        onChange: (value) => api.notify(`#${entity.id}:rawAmountChange`, value),
      })}
      <dl class="ff-detail-list ff-qr-rounding" aria-live="polite">
        <dt>${t("SWISS_QR.ROUNDING_LABEL")}</dt>
        <dd><strong>${decimals(rounded)}</strong></dd>
        <dt>${t("SWISS_QR.DIFF_LABEL")}</dt>
        <dd>${decimals(rounded - raw)}</dd>
      </dl>`,
  })
}

function renderVoucher(bill: QrBill): TemplateResult {
  const amount = formatDecimal(bill.amount)

  return Card.render({
    title: t("SWISS_QR.VOUCHER_TITLE"),
    className: "ff-qr-voucher",
    children: html`<section aria-labelledby="ff-qr-payment-title">
        <h3 id="ff-qr-payment-title" class="ff-detail-heading">
          ${t("SWISS_QR.PAYMENT_PART_TITLE")}
          <small>${t("SWISS_QR.PAYMENT_PART_SUB")}</small>
        </h3>
        <dl class="ff-detail-list">
          <dt>${t("SWISS_QR.CURRENCY_LBL")}</dt>
          <dd>${bill.currency}</dd>
          <dt>${t("SWISS_QR.AMOUNT_LBL")}</dt>
          <dd><strong>${amount}</strong></dd>
          <dt>${t("SWISS_QR.ACCOUNT_PAYABLE_TO")}</dt>
          <dd>
            <strong>${bill.creditor.qrIban ?? "-"}</strong>
            ${renderAddress(bill.creditor)}
          </dd>
          <dt>${t("SWISS_QR.REFERENCE_SCOR")}</dt>
          <dd><code>${formatScor(bill.reference)}</code></dd>
          <dt>${t("SWISS_QR.ADDITIONAL_INFO")}</dt>
          <dd>${bill.unstructuredMessage || "-"}</dd>
          <dt>${t("SWISS_QR.PAYABLE_BY")}</dt>
          <dd>${renderAddress(bill.debtor)}</dd>
        </dl>
      </section>
      <section aria-labelledby="ff-qr-receipt-title" class="ff-qr-receipt">
        <h3 id="ff-qr-receipt-title" class="ff-detail-heading">
          ${t("SWISS_QR.RECEIPT_TITLE")}
        </h3>
        <dl class="ff-detail-list">
          <dt>${t("SWISS_QR.RECEIPT_ACCOUNT")}</dt>
          <dd>${bill.creditor.qrIban ?? "-"}</dd>
          <dt>${t("SWISS_QR.RECEIPT_BENEFICIARY")}</dt>
          <dd>${bill.creditor.name}</dd>
          <dt>${t("SWISS_QR.AMOUNT_LBL")}</dt>
          <dd><strong>${bill.currency} ${amount}</strong></dd>
        </dl>
      </section>`,
  })
}

function renderAddress(address: QrBillAddress): TemplateResult {
  return html`<span class="ff-qr-address">
    <span>${address.name}</span>
    <span>${address.address}</span>
    <span>${address.postalCode} ${address.city}</span>
  </span>`
}

export default QrBillPage
