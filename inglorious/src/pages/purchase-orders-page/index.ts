import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Dialog } from "@inglorious/ui/dialog"
import { Input, type InputProps } from "@inglorious/ui/input"
import { Select } from "@inglorious/ui/select"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"

import type {
  AppApi,
  PurchaseOrderFormEntity,
  PurchaseOrderFormValues,
  PurchaseOrdersGridEntity,
  ResourcePageEntity,
} from "../../../types"
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  listPurchaseOrders,
  listSuppliers,
  transitionPurchaseOrder,
} from "../../api/procurement"
import { fieldError } from "../../forms/field-error"
import { t } from "../../i18n"
import { formatDate, formatMoney } from "../../layout/format"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import { renderKpi } from "../../layout/kpi"
import { renderTag, type TagColor } from "../../layout/tag"
import type {
  CreatePurchaseOrderPayload,
  ProcurementSupplier,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderTransition,
} from "../../models/procurement"
import { type CellContent, withCells } from "../../types/grid-cells"
import { createResourceForm } from "../../types/resource-form"
import { createResourcePage } from "../../types/resource-page"
import { createServerDataGrid } from "../../types/server-data-grid"

const NONE = 0
const ISO_DATE_LENGTH = 10
const START = 0

const STATUSES: PurchaseOrderStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "ordered",
  "received",
]

const STATUS_COLORS: Record<PurchaseOrderStatus, TagColor> = {
  draft: "default",
  pending_approval: "warning",
  approved: "success",
  received: "success",
  ordered: "info",
  rejected: "error",
  cancelled: "error",
}

const CHANNEL_COLORS: Record<PurchaseOrder["channel"], TagColor> = {
  SDI: "info",
  "QR-Bill": "error",
  Standard: "default",
}

// The toast once an order moved on, by the step it took.
const TRANSITION_MESSAGES: Record<PurchaseOrderTransition, string> = {
  "submit-approval": "purchases.messages.submitted",
  approve: "purchases.messages.approved",
  reject: "purchases.messages.rejected",
}

const UNITS = ["PCS", "KG", "M", "H"]

interface PurchaseOrdersGridProps extends DataGridProps<PurchaseOrder> {
  onCreate?: () => void
  onTransition?: (
    order: PurchaseOrder,
    transition: PurchaseOrderTransition,
  ) => void
}

export const PurchaseOrdersGrid = [
  ...createServerDataGrid(listPurchaseOrders, (order: PurchaseOrder) => order),
  {
    ...withCells(
      (props, columnId, order: PurchaseOrder): CellContent => {
        switch (columnId) {
          case "order_number":
            return html`<strong>${order.order_number}</strong>`
          case "channel":
            return renderTag(
              order.channel,
              CHANNEL_COLORS[order.channel] ?? "default",
            )
          case "total":
            return html`<strong
              >${formatMoney(order.total, order.currency)}</strong
            >`
          case "due_date":
            return order.due_date ? formatDate(order.due_date) : "-"
          case "status":
            return renderTag(
              t(`purchases.statuses.${order.status}`),
              STATUS_COLORS[order.status],
            )
          case "actions":
            return renderActions(props, order)
          default:
            return nothing
        }
      },
      (_entity: PurchaseOrdersGridEntity, api: AppApi) => ({
        onCreate: () => api.notify("#purchaseOrders:createOpen"),
        onTransition: (
          order: PurchaseOrder,
          transition: PurchaseOrderTransition,
        ) =>
          api.notify("#purchaseOrders:transition", {
            id: order.id,
            number: order.order_number,
            transition,
          }),
      }),
    ),

    renderToolbar(props: PurchaseOrdersGridProps): TemplateResult {
      return renderGridToolbar({
        ...props,
        searchLabel: "COMMON.SEARCH",
        createLabel: "purchases.form.createTitle",
        controls: Select.render({
          id: `${props.id}-status`,
          size: "sm",
          ariaLabel: t("COMMON.STATUS"),
          value: props.filters.status ?? "",
          options: [
            { value: "", label: t("COMMON.ALL") },
            ...STATUSES.map((status) => ({
              value: status,
              label: t(`purchases.statuses.${status}`),
            })),
          ],
          onChange: (value) =>
            props.onFilterChange?.({
              columnId: "status",
              value: value || null,
            }),
        }),
      })
    },
  },
]

/**
 * A purchase order as the API documents it: a supplier picked from the
 * registry and dated lines. The Angular form sent an invented supplier id and
 * fields the API does not take.
 */
export const PurchaseOrderForm = [
  ...createResourceForm({
    toValues: (): PurchaseOrderFormValues => ({
      supplier_id: "",
      order_date: today(),
      expected_delivery_date: "",
      description: "",
      quantity: "1",
      uom: "PCS",
      unit_price: "0",
    }),
    validate: (values: PurchaseOrderFormValues) => ({
      supplier_id: values.supplier_id ? null : "validation.supplierRequired",
      order_date: values.order_date ? null : "validation.dateRequired",
      expected_delivery_date: values.expected_delivery_date
        ? null
        : "validation.dateRequired",
      description: values.description.trim()
        ? null
        : "validation.descriptionRequired",
      quantity:
        Number(values.quantity) > NONE ? null : "validation.quantityRequired",
      uom: null,
      unit_price:
        values.unit_price !== "" && Number(values.unit_price) >= NONE
          ? null
          : "validation.priceRequired",
    }),
    toPayload: (
      values: PurchaseOrderFormValues,
    ): CreatePurchaseOrderPayload => ({
      supplier_id: values.supplier_id,
      order_date: values.order_date,
      expected_delivery_date: values.expected_delivery_date,
      lines: [
        {
          description: values.description.trim(),
          quantity_ordered: Number(values.quantity),
          unit_price: Number(values.unit_price),
          uom: values.uom,
        },
      ],
    }),
    save: (_id: string | null, payload: CreatePurchaseOrderPayload) =>
      createPurchaseOrder(payload),
    createdKey: "purchases.messages.created",
    updatedKey: "purchases.messages.created",
  }),
  {
    // The registry the supplier is picked from, loaded with the page.
    ...handleAsync("suppliersLoad", {
      run: () => listSuppliers(),
      success(
        entity: PurchaseOrderFormEntity,
        suppliers: ProcurementSupplier[],
      ) {
        entity.suppliers = suppliers.map(({ id, company_name }) => ({
          value: id,
          label: company_name,
        }))
      },
    }),

    render(entity: PurchaseOrderFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      const change = (path: string, value: unknown) =>
        api.notify(`#${id}:fieldChange`, { path, value })
      const field = (
        path: keyof PurchaseOrderFormValues,
        label: string,
        props: Partial<InputProps> = {},
      ) =>
        Input.render({
          id: `${id}-${path}`,
          label: t(label),
          isRequired: true,
          isFullWidth: true,
          value: entity.values[path],
          error: fieldError(entity, path),
          onChange: (value) => change(path, value),
          ...props,
        })

      return Dialog.render({
        id: `${id}-dialog`,
        isOpen: entity.isOpen,
        size: "md",
        title: t("purchases.form.createTitle"),
        closeLabel: t("COMMON.CLOSE"),
        onClose: () => api.notify(`#${id}:close`),
        children: html`<form
          class="ff-form ff-form-columns"
          novalidate
          @submit=${(event: SubmitEvent) => {
            event.preventDefault()
            api.notify(`#${id}:submit`)
          }}
        >
          ${when(entity.failure, () =>
            Alert.render({
              severity: "error",
              description: t(entity.failure!),
            }),
          )}
          ${Select.render({
            id: `${id}-supplier_id`,
            label: t("purchases.form.supplier"),
            isRequired: true,
            isFullWidth: true,
            className: "ff-form-wide",
            value: entity.values.supplier_id,
            error: fieldError(entity, "supplier_id"),
            options: [
              { value: "", label: t("COMMON.SELECT") },
              ...entity.suppliers,
            ],
            onChange: (value) => change("supplier_id", value),
          })}
          ${field("order_date", "purchases.form.orderDate", { inputType: "date" })}
          ${field("expected_delivery_date", "purchases.form.deliveryDate", {
            inputType: "date",
          })}
          ${field("description", "purchases.form.description", {
            placeholder: t("purchases.form.descriptionPlaceholder"),
            className: "ff-form-wide",
          })}
          ${field("quantity", "purchases.form.quantity", { inputType: "number", min: 1 })}
          ${Select.render({
            id: `${id}-uom`,
            label: t("purchases.form.unit"),
            isFullWidth: true,
            value: entity.values.uom,
            options: UNITS,
            onChange: (value) => change("uom", value),
          })}
          ${field("unit_price", "purchases.form.unitPrice", {
            inputType: "number",
            min: 0,
            step: 0.01,
          })}
          <div class="ff-form-actions ff-form-wide">
            ${Button.render({
              children: t("common.actions.cancel"),
              onClick: () => api.notify(`#${id}:close`),
            })}
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              isDisabled: entity.isSubmitting,
              children: t(
                entity.isSubmitting ? "APP.LOADING" : "common.actions.save",
              ),
            })}
          </div>
        </form>`,
      })
    },
  },
  // The supplier list is loaded each time the form opens.
  <T extends object>(type: T) => ({
    open(
      entity: PurchaseOrderFormEntity,
      payload: { id: string | null; gridId: string },
      api: AppApi,
    ) {
      const { open } = type as { open: (...args: unknown[]) => void }
      open(entity, payload, api)
      api.notify(`#${entity.id}:suppliersLoad`)
    },
  }),
]

export const PurchaseOrdersPage = [
  ...createResourcePage({
    remove: deletePurchaseOrder,
    confirmDeleteKey: "COMMON.CONFIRM_DELETE",
    deletedKey: "purchases.messages.deleted",
    renderSummary: (_entity, api) => {
      const { rows } = api.getEntity(
        "purchaseOrdersGrid",
      ) as PurchaseOrdersGridEntity
      const total = (currency: string) =>
        rows
          .filter((order) => order.currency === currency)
          .reduce((sum, order) => sum + (order.total || NONE), NONE)
      return html`<div class="ff-kpis">
        ${renderKpi("PURCHASES.KPI_RECONCILE", rows.length)}
        ${renderKpi("PURCHASES.KPI_PAIN001", formatMoney(total("CHF"), "CHF"))}
        ${renderKpi("PURCHASES.KPI_SEPA", formatMoney(total("EUR"), "EUR"), "success")}
      </div>`
    },
  }),
  {
    ...handleAsync("transition", {
      run: async ({
        id,
        number,
        transition,
      }: {
        id: string
        number: string
        transition: PurchaseOrderTransition
      }) => {
        const reason =
          transition === "reject" ? t("purchases.rejectReason") : undefined
        await transitionPurchaseOrder(id, transition, reason)
        return { number, transition }
      },
      success(
        entity: ResourcePageEntity,
        {
          number,
          transition,
        }: { number: string; transition: PurchaseOrderTransition },
        api: AppApi,
      ) {
        api.notify("#toast:show", {
          key: TRANSITION_MESSAGES[transition],
          values: { number },
        })
        api.notify(`#${entity.gridId}:fetch`)
      },
    }),
  },
]

function renderActions(props: PurchaseOrdersGridProps, order: PurchaseOrder) {
  const button = (
    transition: PurchaseOrderTransition,
    label: string,
    color: "default" | "primary" | "error",
  ) =>
    Button.render({
      size: "sm",
      variant: color === "default" ? "outline" : "default",
      color,
      ariaLabel: `${t(label)}: ${order.order_number}`,
      children: t(label),
      onClick: (event: MouseEvent) => {
        event.stopPropagation()
        props.onTransition?.(order, transition)
      },
    })

  if (order.status === "draft") {
    return button(
      "submit-approval",
      "purchases.actions.submitApproval",
      "default",
    )
  }
  if (order.status === "pending_approval") {
    return html`<div class="ff-row-actions">
      ${button("approve", "purchases.actions.approve", "primary")}
      ${button("reject", "purchases.actions.reject", "error")}
    </div>`
  }
  return nothing
}

function today(): string {
  return new Date().toISOString().slice(START, ISO_DATE_LENGTH)
}

export default PurchaseOrdersPage
