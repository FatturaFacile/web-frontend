import trashIcon from "@iconify-icons/fa7-solid/trash"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Dialog } from "@inglorious/ui/dialog"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Input, type InputProps } from "@inglorious/ui/input"
import { Select } from "@inglorious/ui/select"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"

import type {
  AppApi,
  InventoryGridEntity,
  ProductFormEntity,
  ProductFormValues,
} from "../../../types"
import { createProduct, deleteProduct, listProducts } from "../../api/inventory"
import { fieldError } from "../../forms/field-error"
import { t } from "../../i18n"
import { formatMoney } from "../../layout/format"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import { renderTag } from "../../layout/tag"
import type { CreateProductPayload, ProductItem } from "../../models/inventory"
import { withCells } from "../../types/grid-cells"
import { createResourceForm } from "../../types/resource-form"
import { createResourcePage } from "../../types/resource-page"
import { createServerDataGrid } from "../../types/server-data-grid"

const NONE = 0

// The Angular form's choices.
const WAREHOUSES = ["Chiasso (CH)", "Milano (IT)", "Lugano (CH)"]
const UNITS = [
  { value: "Pz", label: "Pz (Pezzi)" },
  { value: "Kg", label: "Kg (Chilogrammi)" },
  { value: "m", label: "m (Metri)" },
  { value: "Ore", label: "Ore" },
]

interface InventoryGridProps extends DataGridProps<ProductItem> {
  onCreate?: () => void
  onDelete?: (product: ProductItem) => void
}

export const InventoryGrid = [
  ...createServerDataGrid(listProducts, (product: ProductItem) => product),
  {
    ...withCells(
      renderProductCell,
      (entity: InventoryGridEntity, api: AppApi) => ({
        onCreate: () => api.notify(`#${entity.pageId}:createOpen`),
        onDelete: ({ id, sku }: ProductItem) =>
          api.notify(`#${entity.pageId}:deleteAsk`, { id, name: sku }),
      }),
    ),

    renderToolbar(props: InventoryGridProps): TemplateResult {
      return renderGridToolbar({
        ...props,
        searchLabel: "COMMON.SEARCH",
        createLabel: "inventory.modal.createTitle",
      })
    },
  },
]

export const ProductForm = [
  ...createResourceForm({
    toValues: (_product: ProductItem | null, api: AppApi) => ({
      sku: "",
      name: "",
      warehouse:
        api.getEntity("workspace")!.jurisdiction === "CH"
          ? "Chiasso (CH)"
          : "Milano (IT)",
      quantity: "1",
      unit_of_measure: "Pz",
      price: "0",
      hs_code: "",
    }),
    validate,
    toPayload: (values: ProductFormValues, api: AppApi) =>
      toPayload(values, api.getEntity("workspace")!.currency),
    // The Angular page only created products.
    save: (_id: string | null, payload: CreateProductPayload) =>
      createProduct(payload),
    createdKey: "inventory.messages.created",
    updatedKey: "inventory.messages.created",
  }),
  {
    render(entity: ProductFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      const field = (
        path: keyof ProductFormValues,
        label: string,
        props: Partial<InputProps> = {},
      ) =>
        Input.render({
          id: `${id}-${path}`,
          label: t(label),
          isFullWidth: true,
          value: entity.values[path],
          error: fieldError(entity, path),
          onChange: (value) =>
            api.notify(`#${id}:fieldChange`, { path, value }),
          ...props,
        })
      const select = (
        path: keyof ProductFormValues,
        label: string,
        options: { value: string; label: string }[],
      ) =>
        Select.render({
          id: `${id}-${path}`,
          label: t(label),
          isRequired: true,
          isFullWidth: true,
          value: entity.values[path],
          options,
          onChange: (value) =>
            api.notify(`#${id}:fieldChange`, { path, value }),
        })

      return Dialog.render({
        id: `${id}-dialog`,
        isOpen: entity.isOpen,
        size: "md",
        title: t("inventory.modal.createTitle"),
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
          ${field("sku", "INVENTORY.COL_SKU", {
            isRequired: true,
            placeholder: t("inventory.form.skuPlaceholder"),
          })}
          ${select(
            "warehouse",
            "INVENTORY.COL_WAREHOUSE",
            WAREHOUSES.map((warehouse) => ({
              value: warehouse,
              label: warehouse,
            })),
          )}
          ${field("name", "INVENTORY.COL_DESC", {
            isRequired: true,
            placeholder: t("inventory.form.namePlaceholder"),
            className: "ff-form-wide",
          })}
          ${field("quantity", "INVENTORY.COL_QTY", {
            isRequired: true,
            inputType: "number",
            min: 0,
          })}
          ${select("unit_of_measure", "inventory.form.unit", UNITS)}
          ${field("price", "INVENTORY.COL_PRICE", {
            isRequired: true,
            inputType: "number",
            min: 0,
            step: 0.01,
          })}
          ${field("hs_code", "INVENTORY.COL_HS", {
            placeholder: t("inventory.form.customsCodePlaceholder"),
          })}
          <div class="ff-form-actions ff-form-wide">
            ${Button.render({
              children: t("COMMON.CANCEL"),
              onClick: () => api.notify(`#${id}:close`),
            })}
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              isDisabled: entity.isSubmitting,
              children: t(
                entity.isSubmitting ? "APP.LOADING" : "inventory.modal.save",
              ),
            })}
          </div>
        </form>`,
      })
    },
  },
]

export const InventoryPage = createResourcePage({
  remove: deleteProduct,
  confirmDeleteKey: "COMMON.CONFIRM_DELETE",
  deletedKey: "inventory.messages.deleted",
})

function renderProductCell(
  props: InventoryGridProps,
  columnId: string,
  product: ProductItem,
): TemplateResult | string | typeof nothing {
  switch (columnId) {
    case "sku":
      return html`<strong>${product.sku}</strong>`
    case "name":
      return html`${product.name}
      ${when(
        product.description,
        () => html`<div class="ff-sub-text">${product.description}</div>`,
      )}`
    case "warehouse":
      return renderTag(
        product.warehouse,
        product.warehouse.includes("CH") ? "error" : "info",
      )
    case "quantity":
      return html`<strong
        >${product.quantity} ${product.unit_of_measure}</strong
      >`
    case "hs_code":
      return html`<code>${product.hs_code || "-"}</code>`
    case "price":
      return formatMoney(product.price, product.currency)
    case "actions":
      return IconButton.render({
        icon: Icon.render({ icon: trashIcon }),
        ariaLabel: `${t("common.actions.delete")}: ${product.sku}`,
        variant: "ghost",
        color: "error",
        size: "sm",
        onClick: (event: MouseEvent) => {
          event.stopPropagation()
          props.onDelete?.(product)
        },
      })
    default:
      return nothing
  }
}

function validate(values: ProductFormValues) {
  const required = (value: string, key: string) => (value.trim() ? null : key)
  const notNegative = (value: string, key: string) =>
    value.trim() !== "" && Number(value) >= NONE ? null : key

  return {
    sku: required(values.sku, "validation.skuRequired"),
    name: required(values.name, "validation.nameRequired"),
    warehouse: required(values.warehouse, "validation.warehouseRequired"),
    quantity: notNegative(values.quantity, "validation.quantityRequired"),
    unit_of_measure: required(values.unit_of_measure, "validation.required"),
    price: notNegative(values.price, "validation.priceRequired"),
    hs_code: null,
  }
}

function toPayload(
  values: ProductFormValues,
  currency: "EUR" | "CHF",
): CreateProductPayload {
  return {
    sku: values.sku.trim(),
    name: values.name.trim(),
    warehouse: values.warehouse,
    quantity: Number(values.quantity),
    unit_of_measure: values.unit_of_measure,
    price: Number(values.price),
    currency,
    hs_code: values.hs_code.trim() || undefined,
  }
}

export default InventoryPage
