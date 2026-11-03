import listIcon from "@iconify-icons/fa7-solid/list"
import plusIcon from "@iconify-icons/fa7-solid/plus"
import trashIcon from "@iconify-icons/fa7-solid/trash"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Drawer } from "@inglorious/ui/drawer"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Input } from "@inglorious/ui/input"
import { Table } from "@inglorious/ui/table"
import { Tabs } from "@inglorious/ui/tabs"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AccountingPageEntity,
  AccountingTab,
  AppApi,
  LedgerEntryFormEntity,
  LedgerEntryFormValues,
  LedgerGridEntity,
  LedgerRow,
} from "../../../types"
import {
  createLedgerEntry,
  listChartOfAccounts,
  listLedgerEntries,
  listVatSettlements,
} from "../../api/accounting"
import { fieldError } from "../../forms/field-error"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDate, formatMoney } from "../../layout/format"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag, type TagColor } from "../../layout/tag"
import type {
  AccountType,
  ChartOfAccount,
  CreateLedgerEntryPayload,
  LedgerEntry,
  VatSettlement,
} from "../../models/accounting"
import { type CellContent, withCells } from "../../types/grid-cells"
import { createLoadedDataGrid } from "../../types/loaded-data-grid"
import { createResourceForm } from "../../types/resource-form"
import { createServerDataGrid } from "../../types/server-data-grid"

// The ledger's currency, as in the Angular page.
const CURRENCY = "EUR"
const NONE = 0
// An entry has a debit and a credit side at least.
const MIN_LINES = 2
const ISO_DATE_LENGTH = 10
const START = 0
// People count lines from one.
const ORDINAL_OFFSET = 1

const TABS: { value: AccountingTab; label: string; gridId: string }[] = [
  { value: "ledger", label: "accounting.generalLedger", gridId: "ledgerGrid" },
  {
    value: "accounts",
    label: "accounting.chartOfAccounts",
    gridId: "accountsGrid",
  },
  { value: "vat", label: "accounting.vatSettlement", gridId: "vatGrid" },
]

const ACCOUNT_COLORS: Record<AccountType, TagColor> = {
  asset: "info",
  liability: "error",
  equity: "secondary",
  revenue: "success",
  expense: "warning",
}

const VAT_COLORS: Record<VatSettlement["status"], TagColor> = {
  paid: "success",
  settled: "info",
  draft: "default",
}

interface LedgerGridProps extends DataGridProps<LedgerRow> {
  onCreate?: () => void
  onSelect?: (rowId: string) => void
}

export const LedgerGrid = [
  ...createServerDataGrid(listLedgerEntries, toLedgerRow),
  {
    ...withCells(
      (props, columnId, row: LedgerRow): CellContent => {
        switch (columnId) {
          case "entry_number":
            return html`<strong>${row.entry_number}</strong>`
          case "date":
            return formatDate(row.date)
          case "total_debit":
          case "total_credit":
            return formatMoney(row[columnId], CURRENCY)
          case "actions":
            return Button.render({
              size: "sm",
              variant: "outline",
              isPressed: props.selection.includes(row.id),
              ariaLabel: `${t("accounting.actions.lines")}: ${row.entry_number}`,
              children: html`${Icon.render({ icon: listIcon })}
              ${t("accounting.actions.lines")}`,
              onClick: (event: MouseEvent) => {
                event.stopPropagation()
                props.onSelect?.(row.id)
              },
            })
          default:
            return nothing
        }
      },
      (entity: LedgerGridEntity, api: AppApi) => ({
        onCreate: () => api.notify("#accounting:createOpen"),
        // The grid selects a row on a click only: a button selects it from the keyboard too.
        onSelect: (rowId: string) =>
          api.notify(`#${entity.id}:rowClick`, { rowId }),
      }),
    ),

    renderToolbar(props: LedgerGridProps): TemplateResult {
      return renderGridToolbar({
        ...props,
        searchLabel: "accounting.searchPlaceholder",
        createLabel: "accounting.form.title",
      })
    },
  },
]

export const AccountsGrid = {
  ...createLoadedDataGrid(
    listChartOfAccounts,
    (account: ChartOfAccount) => account,
  ),
  ...withCells((_props, columnId, account: ChartOfAccount): CellContent => {
    if (columnId === "type") {
      return renderTag(
        t(`accounting.accountType.${account.type}`),
        ACCOUNT_COLORS[account.type],
      )
    }
    if (columnId === "balance")
      return formatMoney(account.balance, account.currency || CURRENCY)
    return nothing
  }),
}

export const VatGrid = {
  ...createLoadedDataGrid(
    listVatSettlements,
    (settlement: VatSettlement) => settlement,
  ),
  ...withCells((_props, columnId, settlement: VatSettlement): CellContent => {
    switch (columnId) {
      case "total_vat_collected":
      case "total_vat_paid":
      case "balance":
        return formatMoney(
          settlement[columnId],
          settlement.jurisdiction === "CH" ? "CHF" : "EUR",
        )
      case "status":
        return renderTag(
          t(`accounting.vatStatus.${settlement.status}`),
          VAT_COLORS[settlement.status],
        )
      default:
        return nothing
    }
  }),
}

/**
 * A journal entry and its lines. The Angular form opened on two sample lines
 * (cash 100 against suppliers 100), easy to post unchanged: these start empty.
 */
export const LedgerEntryForm = [
  ...createResourceForm({
    toValues: (): LedgerEntryFormValues => ({
      entry_number: "",
      date: new Date().toISOString().slice(START, ISO_DATE_LENGTH),
      description: "",
      lines: [emptyLine(), emptyLine()],
    }),
    validate: (values: LedgerEntryFormValues) => ({
      entry_number: values.entry_number.trim()
        ? null
        : "validation.entryNumberRequired",
      date: values.date ? null : "validation.dateRequired",
      description: values.description.trim()
        ? null
        : "validation.descriptionRequired",
      lines: values.lines.map((line) => ({
        account_id: line.account_id.trim() ? null : "validation.required",
        debit: null,
        credit: null,
        description: null,
      })),
    }),
    toPayload: (values: LedgerEntryFormValues): CreateLedgerEntryPayload => ({
      entry_number: values.entry_number.trim(),
      date: values.date,
      description: values.description.trim(),
      lines: values.lines.map((line) => ({
        account_id: line.account_id.trim(),
        debit: Number(line.debit) || NONE,
        credit: Number(line.credit) || NONE,
        description: line.description.trim() || undefined,
      })),
    }),
    save: (_id: string | null, payload: CreateLedgerEntryPayload) =>
      createLedgerEntry(payload),
    createdKey: "accounting.messages.entrySaved",
    updatedKey: "accounting.messages.entrySaved",
  }),
  {
    render(entity: LedgerEntryFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      const change = (path: string, value: unknown) =>
        api.notify(`#${id}:fieldChange`, { path, value })
      const { debit, credit } = totals(entity.values.lines)
      const isBalanced = debit === credit && debit > NONE

      return Drawer.render({
        id: `${id}-drawer`,
        variant: "temporary",
        anchor: "right",
        isOpen: entity.isOpen,
        title: t("accounting.form.title"),
        closeLabel: t("COMMON.CLOSE"),
        className: "ff-form-drawer ff-form-drawer-wide",
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
            id: `${id}-entry_number`,
            label: t("accounting.form.entryNumber"),
            placeholder: t("accounting.form.entryNumberPlaceholder"),
            isRequired: true,
            isFullWidth: true,
            value: entity.values.entry_number,
            error: fieldError(entity, "entry_number"),
            onChange: (value) => change("entry_number", value),
          })}
          ${Input.render({
            id: `${id}-date`,
            label: t("accounting.form.date"),
            inputType: "date",
            isRequired: true,
            isFullWidth: true,
            value: entity.values.date,
            error: fieldError(entity, "date"),
            onChange: (value) => change("date", value),
          })}
          ${Input.render({
            id: `${id}-description`,
            label: t("accounting.form.description"),
            placeholder: t("accounting.form.descriptionPlaceholder"),
            isRequired: true,
            isFullWidth: true,
            value: entity.values.description,
            error: fieldError(entity, "description"),
            onChange: (value) => change("description", value),
          })}
          <fieldset class="ff-fieldset">
            <legend>${t("accounting.form.linesTitle")}</legend>
            ${entity.values.lines.map(
              (line, index) =>
                html`<div class="ff-ledger-line">
                  ${Input.render({
                    id: `${id}-line-${index}-account`,
                    ariaLabel: `${t("accounting.table.account")} ${index + ORDINAL_OFFSET}`,
                    placeholder: t("accounting.form.accountIdPlaceholder"),
                    isFullWidth: true,
                    value: line.account_id,
                    error: fieldError(entity, `lines.${index}.account_id`),
                    onChange: (value) =>
                      change(`lines.${index}.account_id`, value),
                  })}
                  ${Input.render({
                    id: `${id}-line-${index}-debit`,
                    ariaLabel: `${t("accounting.table.debit")} ${index + ORDINAL_OFFSET}`,
                    placeholder: t("accounting.form.debitPlaceholder"),
                    inputType: "number",
                    min: 0,
                    step: 0.01,
                    value: line.debit,
                    onChange: (value) => change(`lines.${index}.debit`, value),
                  })}
                  ${Input.render({
                    id: `${id}-line-${index}-credit`,
                    ariaLabel: `${t("accounting.table.credit")} ${index + ORDINAL_OFFSET}`,
                    placeholder: t("accounting.form.creditPlaceholder"),
                    inputType: "number",
                    min: 0,
                    step: 0.01,
                    value: line.credit,
                    onChange: (value) => change(`lines.${index}.credit`, value),
                  })}
                  ${IconButton.render({
                    icon: Icon.render({ icon: trashIcon }),
                    ariaLabel: `${t("SALES.INVOICES.FORM.REMOVE_ITEM")} ${index + ORDINAL_OFFSET}`,
                    variant: "ghost",
                    color: "error",
                    isDisabled: entity.values.lines.length <= MIN_LINES,
                    onClick: () =>
                      api.notify(`#${id}:fieldArrayRemove`, {
                        path: "lines",
                        index,
                      }),
                  })}
                </div>`,
            )}
            ${Button.render({
              size: "sm",
              variant: "outline",
              children: html`${Icon.render({ icon: plusIcon })}
              ${t("SALES.INVOICES.FORM.ADD_ITEM")}`,
              onClick: () =>
                api.notify(`#${id}:fieldArrayAppend`, {
                  path: "lines",
                  value: emptyLine(),
                }),
            })}
          </fieldset>
          <dl class="ff-detail-list" aria-live="polite">
            <dt>${t("accounting.form.totalDebit")}</dt>
            <dd>${formatMoney(debit, CURRENCY)}</dd>
            <dt>${t("accounting.form.totalCredit")}</dt>
            <dd>${formatMoney(credit, CURRENCY)}</dd>
          </dl>
          ${when(debit !== credit, () =>
            Alert.render({
              severity: "warning",
              description: t("accounting.errors.unbalancedEntry"),
            }),
          )}
          <div class="ff-form-actions">
            ${Button.render({
              children: t("common.actions.cancel"),
              onClick: () => api.notify(`#${id}:close`),
            })}
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              isDisabled: entity.isSubmitting || !isBalanced,
              children: t(
                entity.isSubmitting ? "APP.LOADING" : "common.actions.save",
              ),
            })}
          </div>
        </form>`,
      })
    },
  },
]

export const AccountingPage = [
  {
    routeChange: pageRouteChange<AccountingPageEntity & { id: string }>({
      open: (entity, _, api) => openTab(entity.tab, api),
    }),

    tabChange(entity: AccountingPageEntity, tab: AccountingTab, api: AppApi) {
      entity.tab = tab
      openTab(tab, api)
    },

    createOpen(_entity: AccountingPageEntity, _: void, api: AppApi) {
      api.notify("#ledgerEntryForm:open", { id: null, gridId: "ledgerGrid" })
    },

    render(entity: AccountingPageEntity, api: AppApi): TemplateResult {
      const ledger = api.getEntity("ledgerGrid") as LedgerGridEntity
      const [selectedId] = ledger.selection
      const selected = ledger.rows.find((row) => row.id === selectedId)
      const grid = api.getEntity(
        TABS.find(({ value }) => value === entity.tab)!.gridId,
      ) as { failure?: string | null }

      return html`
        ${renderPageHeader("accounting.title", "accounting.subtitle")}
        ${when(grid.failure, () =>
          Alert.render({ severity: "error", description: t(grid.failure!) }),
        )}
        ${Card.render({
          children: Tabs.render({
            id: `${entity.id}-tabs`,
            value: entity.tab,
            items: TABS.map(({ value, label, gridId }) => ({
              value,
              label: t(label),
              panel:
                value === entity.tab ? html`${api.render(gridId)}` : undefined,
            })),
            onChange: (tab) =>
              api.notify(`#${entity.id}:tabChange`, tab as AccountingTab),
          }),
        })}
        ${when(entity.tab === "ledger" && selected, () => renderLines(selected!))}
        ${api.render("ledgerEntryForm")}
      `
    },
  },
  requireAuth,
]

function openTab(tab: AccountingTab, api: { notify: AppApi["notify"] }) {
  const gridId = TABS.find(({ value }) => value === tab)!.gridId
  api.notify(`#${gridId}:fetch`)
}

function toLedgerRow(entry: LedgerEntry): LedgerRow {
  const { debit, credit } = totals(entry.lines ?? [])
  return { ...entry, total_debit: debit, total_credit: credit }
}

function totals(lines: { debit: number | string; credit: number | string }[]) {
  return lines.reduce<{ debit: number; credit: number }>(
    ({ debit, credit }, line) => ({
      debit: debit + (Number(line.debit) || NONE),
      credit: credit + (Number(line.credit) || NONE),
    }),
    { debit: NONE, credit: NONE },
  )
}

function emptyLine() {
  return { account_id: "", debit: "0", credit: "0", description: "" }
}

function renderLines(entry: LedgerRow): TemplateResult {
  const money = (amount: number) =>
    amount > NONE ? formatMoney(amount, CURRENCY) : "-"
  return Card.render({
    title: t("accounting.entryDetailTitle", { number: entry.entry_number }),
    className: "ff-detail-card",
    children: Table.render({
      isFullWidth: true,
      columns: [
        { id: "account", label: t("accounting.table.account") },
        { id: "description", label: t("accounting.table.description") },
        { id: "debit", label: t("accounting.table.debit"), align: "right" },
        { id: "credit", label: t("accounting.table.credit"), align: "right" },
      ],
      rows: entry.lines.map((line) => ({
        account: html`<code>${line.account_code || line.account_id}</code> -
          ${line.account_name || t("accounting.table.account")}`,
        description: line.description || "-",
        debit: money(Number(line.debit)),
        credit: money(Number(line.credit)),
      })),
    }),
  })
}

export default AccountingPage
