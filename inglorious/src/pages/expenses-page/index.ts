import download from "@iconify-icons/fa7-solid/download"
import penIcon from "@iconify-icons/fa7-solid/pen"
import trashIcon from "@iconify-icons/fa7-solid/trash"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Drawer } from "@inglorious/ui/drawer"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Input } from "@inglorious/ui/input"
import { Select } from "@inglorious/ui/select"
import { Textarea } from "@inglorious/ui/textarea"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"

import type {
  AppApi,
  ExpenseFormEntity,
  ExpenseFormValues,
  ExpensesGridEntity,
  ExpensesPageEntity,
} from "../../../types"
import { saveFile } from "../../api/download"
import {
  deleteExpense,
  exportExpenses,
  listExpenses,
  saveExpense,
} from "../../api/expenses"
import { fieldError } from "../../forms/field-error"
import { t } from "../../i18n"
import { formatDate, formatMoney } from "../../layout/format"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import { renderKpi } from "../../layout/kpi"
import { renderTag, type TagColor } from "../../layout/tag"
import type {
  ExpensePayload,
  ExpenseResource,
  ExpenseStatus,
} from "../../models/expenses"
import { type CellContent, withCells } from "../../types/grid-cells"
import { createResourceForm } from "../../types/resource-form"
import { createResourcePage } from "../../types/resource-page"
import { createServerDataGrid } from "../../types/server-data-grid"

const NONE = 0
const ISO_DATE_LENGTH = 10
const START = 0
const DESCRIPTION_ROWS = 3

const STATUSES: ExpenseStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "reimbursed",
  "paid",
]

const STATUS_COLORS: Record<ExpenseStatus, TagColor> = {
  draft: "default",
  pending_approval: "warning",
  approved: "success",
  rejected: "error",
  reimbursed: "info",
  paid: "success",
}

interface ExpensesGridProps extends DataGridProps<ExpenseResource> {
  onCreate?: () => void
  onEdit?: (expense: ExpenseResource) => void
  onDelete?: (expense: ExpenseResource) => void
  onExport?: () => void
  isExporting?: boolean
}

export const ExpensesGrid = [
  ...createServerDataGrid(listExpenses, (expense: ExpenseResource) => expense),
  {
    ...withCells(
      (props, columnId, expense: ExpenseResource): CellContent => {
        switch (columnId) {
          case "date":
            return formatDate(expense.date)
          case "merchant":
            return expense.merchant || "-"
          case "amount":
            return html`<strong
              >${formatMoney(expense.amount, expense.currency)}</strong
            >`
          case "status":
            return renderTag(
              t(`expenses.statuses.${expense.status}`),
              STATUS_COLORS[expense.status],
            )
          case "actions":
            return html`<div class="ff-row-actions">
              ${IconButton.render({
                icon: Icon.render({ icon: penIcon }),
                ariaLabel: `${t("expenses.actions.edit")}: ${expense.description}`,
                variant: "ghost",
                size: "sm",
                onClick: (event: MouseEvent) => {
                  event.stopPropagation()
                  props.onEdit?.(expense)
                },
              })}
              ${IconButton.render({
                icon: Icon.render({ icon: trashIcon }),
                ariaLabel: `${t("expenses.actions.delete")}: ${expense.description}`,
                variant: "ghost",
                color: "error",
                size: "sm",
                onClick: (event: MouseEvent) => {
                  event.stopPropagation()
                  props.onDelete?.(expense)
                },
              })}
            </div>`
          default:
            return nothing
        }
      },
      (_entity: ExpensesGridEntity, api: AppApi) => ({
        onCreate: () => api.notify("#expenses:createOpen"),
        onEdit: ({ id }: ExpenseResource) =>
          api.notify("#expenses:editOpen", id),
        onDelete: ({ id, description }: ExpenseResource) =>
          api.notify("#expenses:deleteAsk", { id, name: description }),
        onExport: () => api.notify("#expenses:export"),
        isExporting: (api.getEntity("expenses") as ExpensesPageEntity)
          .isExporting,
      }),
    ),

    renderToolbar(props: ExpensesGridProps): TemplateResult {
      return renderGridToolbar({
        ...props,
        searchLabel: "expenses.searchPlaceholder",
        createLabel: "expenses.form.createTitle",
        controls: html`${Select.render({
          id: `${props.id}-status`,
          size: "sm",
          ariaLabel: t("expenses.filterStatus"),
          value: props.filters.status ?? "",
          options: [
            { value: "", label: t("COMMON.ALL") },
            ...STATUSES.map((status) => ({
              value: status,
              label: t(`expenses.statuses.${status}`),
            })),
          ],
          onChange: (value) =>
            props.onFilterChange?.({
              columnId: "status",
              value: value || null,
            }),
        })}
        ${Button.render({
          size: "sm",
          variant: "outline",
          isDisabled: props.isExporting,
          children: html`${Icon.render({ icon: download })}
          ${t(props.isExporting ? "APP.LOADING" : "expenses.actions.export")}`,
          onClick: () => props.onExport?.(),
        })}`,
      })
    },
  },
]

export const ExpenseForm = [
  ...createResourceForm({
    toValues: (
      expense: ExpenseResource | null,
      api: AppApi,
    ): ExpenseFormValues => ({
      date: expense?.date?.slice(START, ISO_DATE_LENGTH) ?? today(),
      amount: expense ? String(expense.amount) : "",
      currency:
        (expense?.currency as "EUR" | "CHF" | undefined) ??
        api.getEntity("workspace")!.currency,
      description: expense?.description ?? "",
      merchant: expense?.merchant ?? "",
      status: expense?.status ?? "draft",
    }),
    validate: (values: ExpenseFormValues) => ({
      date: values.date ? null : "validation.dateRequired",
      amount: Number(values.amount) > NONE ? null : "validation.amountRequired",
      currency: null,
      description: values.description.trim()
        ? null
        : "validation.descriptionRequired",
      merchant: null,
      status: null,
    }),
    toPayload: (values: ExpenseFormValues): ExpensePayload => ({
      date: values.date,
      amount: Number(values.amount),
      currency: values.currency,
      description: values.description.trim(),
      merchant: values.merchant.trim() || undefined,
      status: values.status,
    }),
    save: saveExpense,
    createdKey: "expenses.messages.created",
    updatedKey: "expenses.messages.updated",
  }),
  {
    render(entity: ExpenseFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      const change = (path: keyof ExpenseFormValues, value: unknown) =>
        api.notify(`#${id}:fieldChange`, { path, value })

      return Drawer.render({
        id: `${id}-drawer`,
        variant: "temporary",
        anchor: "right",
        isOpen: entity.isOpen,
        title: t(
          entity.editingId
            ? "expenses.form.editTitle"
            : "expenses.form.createTitle",
        ),
        closeLabel: t("COMMON.CLOSE"),
        className: "ff-form-drawer",
        onClose: () => api.notify(`#${id}:close`),
        children: html`<form
          class="ff-form"
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
          ${Input.render({
            id: `${id}-date`,
            label: t("expenses.form.date"),
            inputType: "date",
            isRequired: true,
            isFullWidth: true,
            value: entity.values.date,
            error: fieldError(entity, "date"),
            onChange: (value) => change("date", value),
          })}
          ${Input.render({
            id: `${id}-amount`,
            label: t("expenses.form.amount"),
            inputType: "number",
            min: 0.01,
            step: 0.01,
            isRequired: true,
            isFullWidth: true,
            value: entity.values.amount,
            error: fieldError(entity, "amount"),
            onChange: (value) => change("amount", value),
          })}
          ${Select.render({
            id: `${id}-currency`,
            label: t("expenses.form.currency"),
            isFullWidth: true,
            value: entity.values.currency,
            options: [
              { value: "EUR", label: "EUR (€)" },
              { value: "CHF", label: "CHF (Fr.)" },
            ],
            onChange: (value) => change("currency", value),
          })}
          ${Textarea.render({
            id: `${id}-description`,
            label: t("expenses.form.description"),
            placeholder: t("expenses.form.descriptionPlaceholder"),
            rows: DESCRIPTION_ROWS,
            isRequired: true,
            isFullWidth: true,
            value: entity.values.description,
            error: fieldError(entity, "description"),
            onChange: (value) => change("description", value),
          })}
          ${Input.render({
            id: `${id}-merchant`,
            label: t("expenses.form.merchant"),
            placeholder: t("expenses.form.merchantPlaceholder"),
            isFullWidth: true,
            value: entity.values.merchant,
            onChange: (value) => change("merchant", value),
          })}
          ${Select.render({
            id: `${id}-status`,
            label: t("common.status.label"),
            isFullWidth: true,
            value: entity.values.status,
            options: STATUSES.map((status) => ({
              value: status,
              label: t(`expenses.statuses.${status}`),
            })),
            onChange: (value) => change("status", value),
          })}
          <div class="ff-form-actions">
            ${Button.render({
              children: t("common.actions.cancel"),
              onClick: () => api.notify(`#${id}:close`),
            })}
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              isDisabled: entity.isSubmitting,
              children: t(
                entity.isSubmitting ? "APP.LOADING" : "expenses.form.submit",
              ),
            })}
          </div>
        </form>`,
      })
    },
  },
]

export const ExpensesPage = [
  ...createResourcePage({
    remove: deleteExpense,
    confirmDeleteKey: "expenses.confirmDelete",
    deletedKey: "expenses.messages.deleted",
    renderSummary: (_entity, api) => {
      const grid = api.getEntity("expensesGrid") as ExpensesGridEntity
      const totals = ["EUR", "CHF"]
        .map((currency) => ({
          currency,
          sum: grid.rows
            .filter((expense) => expense.currency === currency)
            .reduce(
              (sum, expense) => sum + (Number(expense.amount) || NONE),
              NONE,
            ),
        }))
        .filter(({ sum }) => sum > NONE)
      return html`<div class="ff-kpis">
        ${renderKpi(
          "expenses.stats.total",
          totals.length
            ? totals
                .map(({ currency, sum }) => formatMoney(sum, currency))
                .join(" · ")
            : formatMoney(NONE, "EUR"),
        )}
        ${renderKpi(
          "expenses.stats.pending",
          grid.rows.filter(
            ({ status }) => status === "draft" || status === "pending_approval",
          ).length,
          "warning",
        )}
        ${renderKpi("expenses.stats.count", grid.totalRows ?? NONE)}
      </div>`
    },
  }),
  {
    // The Angular page announced a completed export even when it failed.
    ...handleAsync("export", {
      start(entity: ExpensesPageEntity) {
        entity.isExporting = true
      },
      async run() {
        saveFile(await exportExpenses(), `expenses-${today()}.csv`)
      },
      finally(entity: ExpensesPageEntity) {
        entity.isExporting = false
      },
    }),
  },
]

function today(): string {
  return new Date().toISOString().slice(START, ISO_DATE_LENGTH)
}

export default ExpensesPage
