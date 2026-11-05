import arrowsRotate from "@iconify-icons/fa7-solid/arrows-rotate"
import copy from "@iconify-icons/fa7-solid/copy"
import ellipsis from "@iconify-icons/fa7-solid/ellipsis-vertical"
import envelope from "@iconify-icons/fa7-solid/envelope"
import filePdf from "@iconify-icons/fa7-solid/file-pdf"
import paperPlane from "@iconify-icons/fa7-solid/paper-plane"
import qrcode from "@iconify-icons/fa7-solid/qrcode"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { ConfirmDialog } from "@inglorious/ui/confirm-dialog"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Icon, type IconData } from "@inglorious/ui/icon"
import { Menu, type MenuItem } from "@inglorious/ui/menu"
import { Select } from "@inglorious/ui/select"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AppApi,
  InvoicePendingAction,
  InvoicesGridEntity,
  InvoicesPageEntity,
} from "../../../types"
import { openFile } from "../../api/download"
import {
  downloadInvoicePdf,
  generateQrBill,
  getInvoice,
  listInvoices,
  runInvoiceAction,
} from "../../api/invoices"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDate, formatMoney } from "../../layout/format"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag, type TagColor } from "../../layout/tag"
import type {
  InvoiceConfirmedAction,
  InvoiceResource,
  InvoiceStatus,
  Jurisdiction,
  PaymentStatus,
} from "../../models/invoice"
import { type CellContent, withCells } from "../../types/grid-cells"
import { createServerDataGrid } from "../../types/server-data-grid"
import { JURISDICTIONS } from "./invoice-form"

export { ContactPicker, InvoiceForm } from "./invoice-form"

type InvoiceAction = InvoiceConfirmedAction | "pdf" | "qrBill" | "duplicate"

const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "partially_paid",
  "paid",
  "overdue",
]

const STATUS_COLORS: Record<InvoiceStatus, TagColor> = {
  draft: "default",
  issued: "info",
  paid: "success",
  cancelled: "error",
}

// What each action that asks first says, and the toast once it is done.
const CONFIRMATIONS: Record<
  InvoiceConfirmedAction,
  { question: string; done: string }
> = {
  email: {
    question: "SALES.INVOICES.ACTIONS.CONFIRM_EMAIL",
    done: "SALES.INVOICES.MESSAGES.EMAIL_SENT",
  },
  sdi: {
    question: "SALES.INVOICES.ACTIONS.CONFIRM_SDI",
    done: "SALES.INVOICES.MESSAGES.SDI_SENT",
  },
  proforma: {
    question: "SALES.INVOICES.ACTIONS.CONFIRM_PROFORMA",
    done: "SALES.INVOICES.MESSAGES.PROFORMA_CONVERTED",
  },
}

interface InvoicesGridProps extends DataGridProps<InvoiceResource> {
  /** The invoice an action is running on. */
  busyId?: string | null
  onCreate?: () => void
  onAction?: (action: InvoiceAction, invoice: InvoiceResource) => void
}

export const InvoicesGrid = [
  ...createServerDataGrid(listInvoices, (invoice: InvoiceResource) => invoice),
  {
    ...withCells(
      (props, columnId, invoice: InvoiceResource): CellContent => {
        switch (columnId) {
          case "invoice_number":
            return html`<strong>${invoice.invoice_number}</strong>
              ${invoice.has_swiss_qr ? renderTag("QR", "secondary") : nothing}`
          case "issue_date":
            return formatDate(invoice.issue_date)
          case "due_date":
            return invoice.due_date ? formatDate(invoice.due_date) : "-"
          case "subtotal":
          case "tax_amount":
            return formatMoney(invoice[columnId], invoice.currency)
          case "total":
            return html`<strong
              >${formatMoney(invoice.total, invoice.currency)}</strong
            >`
          case "status":
            return renderStatus(invoice)
          case "jurisdiction":
            return renderTag(
              t(`SALES.INVOICES.JURISDICTIONS.${jurisdictionOf(invoice)}`),
              "info",
            )
          case "actions":
            return renderActions(props, invoice)
          default:
            return nothing
        }
      },
      (_entity: InvoicesGridEntity, api: AppApi) => ({
        busyId: (api.getEntity("invoices") as InvoicesPageEntity).busyId,
        onCreate: () => api.notify("#invoices:createOpen"),
        onAction: (action: InvoiceAction, invoice: InvoiceResource) => {
          const request = { id: invoice.id, number: invoice.invoice_number }
          if (action in CONFIRMATIONS) {
            api.notify("#invoices:actionAsk", { ...request, action })
          } else {
            api.notify(`#invoices:${action}`, request)
          }
        },
      }),
    ),

    renderToolbar(props: InvoicesGridProps): TemplateResult {
      const filter = (
        columnId: string,
        label: string,
        options: { value: string; label: string }[],
      ) =>
        Select.render({
          id: `${props.id}-${columnId}`,
          size: "sm",
          ariaLabel: t(label),
          value: (props.filters[columnId] as string | undefined) ?? "",
          options: [{ value: "", label: t(label) }, ...options],
          onChange: (value) =>
            props.onFilterChange?.({ columnId, value: value || null }),
        })

      return renderGridToolbar({
        ...props,
        searchLabel: "SALES.INVOICES.SEARCH_PLACEHOLDER",
        createLabel: "SALES.INVOICES.NEW",
        controls: html`${filter(
          "payment_status",
          "SALES.INVOICES.FILTER_PAYMENT",
          PAYMENT_STATUSES.map((status) => ({
            value: status,
            label: t(`SALES.INVOICES.PAYMENT.${status.toUpperCase()}`),
          })),
        )}
        ${filter(
          "jurisdiction",
          "SALES.INVOICES.FILTER_JURISDICTION",
          JURISDICTIONS.map((jurisdiction) => ({
            value: jurisdiction,
            label: t(`SALES.INVOICES.JURISDICTIONS.${jurisdiction}`),
          })),
        )}`,
      })
    },
  },
]

/**
 * The invoices, with what can be done to each: its PDF, sending it by email
 * or to SDI, a Swiss QR-bill, converting a proforma, and copying it as a new
 * draft. A failure is toasted, as with every request.
 */
export const InvoicesPage = [
  {
    routeChange: pageRouteChange<InvoicesPageEntity & { id: string }>({
      open: (entity, _, api) => api.notify(`#${entity.gridId}:fetch`),
      close: (entity) => {
        entity.pending = null
      },
    }),

    createOpen(entity: InvoicesPageEntity, _: void, api: AppApi) {
      api.notify(`#${entity.formId}:open`, { id: null, gridId: entity.gridId })
    },

    // The copy needs the invoice's lines, which the list leaves out.
    ...handleAsync("duplicate", {
      start: markBusy,
      run: ({ id }: InvoiceRequest) => getInvoice(id),
      success(
        entity: InvoicesPageEntity,
        invoice: Awaited<ReturnType<typeof getInvoice>>,
        api: AppApi,
      ) {
        api.notify(`#${entity.formId}:duplicateOpen`, {
          gridId: entity.gridId,
          invoice,
        })
      },
      finally: clearBusy,
    }),

    ...handleAsync("pdf", {
      start: markBusy,
      async run({ id, number }: InvoiceRequest) {
        openFile(await downloadInvoicePdf(id), `${number}.pdf`)
      },
      finally: clearBusy,
    }),

    ...handleAsync("qrBill", {
      start: markBusy,
      async run({ id, number }: InvoiceRequest) {
        openFile(await generateQrBill(id), `${number}-qr-bill.pdf`)
      },
      success(entity: InvoicesPageEntity, _: unknown, api: AppApi) {
        api.notify("#toast:show", {
          key: "SALES.INVOICES.MESSAGES.QR_GENERATED",
        })
        api.notify(`#${entity.gridId}:fetch`)
      },
      finally: clearBusy,
    }),

    actionAsk(entity: InvoicesPageEntity, pending: InvoicePendingAction) {
      entity.pending = pending
    },

    actionCancel(entity: InvoicesPageEntity) {
      if (!entity.isWorking) entity.pending = null
    },

    ...handleAsync("actionConfirm", {
      start(entity: InvoicesPageEntity) {
        entity.isWorking = true
      },
      async run({ action, id }: InvoicePendingAction) {
        await runInvoiceAction(action, id)
        return action
      },
      success(
        entity: InvoicesPageEntity,
        action: InvoiceConfirmedAction,
        api: AppApi,
      ) {
        entity.pending = null
        api.notify("#toast:show", { key: CONFIRMATIONS[action].done })
        // An email changes nothing the list shows.
        if (action !== "email") api.notify(`#${entity.gridId}:fetch`)
      },
      finally(entity: InvoicesPageEntity) {
        entity.isWorking = false
      },
    }),

    render(entity: InvoicesPageEntity, api: AppApi): TemplateResult {
      const grid = api.getEntity(entity.gridId) as InvoicesGridEntity
      const { pending, id } = entity

      return html`
        ${renderPageHeader("SALES.INVOICES.TITLE", "SALES.INVOICES.SUBTITLE")}
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
        ${api.render(entity.formId)}
        ${ConfirmDialog.render({
          id: `${id}-confirm`,
          isOpen: Boolean(pending),
          tone: pending?.action === "sdi" ? "danger" : "primary",
          message: pending ? t(CONFIRMATIONS[pending.action].question) : "",
          children: html`<strong>${pending?.number}</strong>`,
          confirmLabel: t("SALES.INVOICES.ACTIONS.OK"),
          cancelLabel: t("COMMON.CANCEL"),
          busyLabel: t("APP.LOADING"),
          closeLabel: t("COMMON.CLOSE"),
          isBusy: entity.isWorking,
          onConfirm: () =>
            pending && api.notify(`#${id}:actionConfirm`, { ...pending }),
          onCancel: () => api.notify(`#${id}:actionCancel`),
        })}
      `
    },
  },
  requireAuth,
]

interface InvoiceRequest {
  id: string
  number: string
}

function markBusy(entity: InvoicesPageEntity, { id }: InvoiceRequest) {
  entity.busyId = id
}

function clearBusy(entity: InvoicesPageEntity) {
  entity.busyId = null
}

function jurisdictionOf(invoice: InvoiceResource): Jurisdiction {
  return invoice.jurisdiction ?? (invoice.currency === "CHF" ? "CH" : "IT")
}

function renderStatus(invoice: InvoiceResource): TemplateResult {
  if (invoice.invoice_type === "proforma") {
    return renderTag(t("SALES.INVOICES.STATUS.PROFORMA"), "secondary")
  }
  if (invoice.payment_status === "overdue" && invoice.status !== "paid") {
    return renderTag(t("SALES.INVOICES.STATUS.OVERDUE"), "error")
  }
  return renderTag(
    t(`SALES.INVOICES.STATUS.${invoice.status.toUpperCase()}`),
    STATUS_COLORS[invoice.status] ?? "default",
  )
}

/**
 * A menu of what applies to the invoice: SDI is Italian, the QR-bill Swiss,
 * the conversion for proformas only.
 *
 * The invoice form cancels the default action of every button click that
 * reaches the document, and the menu opens by its buttons' default actions
 * (`commandfor`): clicks inside it stop here.
 */
function renderActions(
  props: InvoicesGridProps,
  invoice: InvoiceResource,
): TemplateResult {
  const jurisdiction = jurisdictionOf(invoice)
  const item = (
    value: InvoiceAction,
    icon: IconData,
    label: string,
  ): MenuItem => ({ value, icon: Icon.render({ icon }), label: t(label) })
  const items = [
    item("pdf", filePdf, "SALES.INVOICES.ACTIONS.DOWNLOAD_PDF"),
    item("email", envelope, "SALES.INVOICES.ACTIONS.SEND_EMAIL"),
    jurisdiction === "IT" &&
      item("sdi", paperPlane, "SALES.INVOICES.ACTIONS.SEND_SDI"),
    jurisdiction === "CH" &&
      item("qrBill", qrcode, "SALES.INVOICES.ACTIONS.GENERATE_QR_BILL"),
    invoice.invoice_type === "proforma" &&
      item("proforma", arrowsRotate, "SALES.INVOICES.ACTIONS.CONVERT_PROFORMA"),
    item("duplicate", copy, "SALES.INVOICES.ACTIONS.DUPLICATE"),
  ].filter((entry): entry is MenuItem => Boolean(entry))

  return html`<div @click=${(event: Event) => event.stopPropagation()}>
    ${Menu.render({
      id: `${props.id}-actions-${invoice.id}`,
      trigger: Icon.render({ icon: ellipsis }),
      triggerProps: {
        variant: "ghost",
        size: "sm",
        isDisabled: props.busyId === invoice.id,
        ariaLabel: t("SALES.INVOICES.ACTIONS.MORE", {
          number: invoice.invoice_number,
        }),
      },
      items,
      onItemClick: (value) => props.onAction?.(value as InvoiceAction, invoice),
    })}
  </div>`
}

export default InvoicesPage
