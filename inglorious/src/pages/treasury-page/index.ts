import arrowsRotate from "@iconify-icons/fa7-solid/arrows-rotate"
import upload from "@iconify-icons/fa7-solid/upload"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Dialog } from "@inglorious/ui/dialog"
import { Icon } from "@inglorious/ui/icon"
import { RadioGroup } from "@inglorious/ui/radio-group"
import { Tabs } from "@inglorious/ui/tabs"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AppApi,
  TransactionsGridEntity,
  TreasuryGridEntity,
  TreasuryPageEntity,
  TreasuryTab,
} from "../../../types"
import {
  autoMatchTransactions,
  importStatement,
  listBankAccounts,
  listStatements,
  listTransactions,
  reconcileStatement,
} from "../../api/treasury"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDate, formatMoney } from "../../layout/format"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import { renderKpi } from "../../layout/kpi"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag, type TagColor } from "../../layout/tag"
import type {
  BankAccountResource,
  BankStatement,
  BankTransactionResource,
  ImportFormat,
  StatementStatus,
} from "../../models/treasury"
import { type CellContent, withCells } from "../../types/grid-cells"
import { createLoadedDataGrid } from "../../types/loaded-data-grid"
import { createServerDataGrid } from "../../types/server-data-grid"

const NO_BALANCE = 0

const TABS: { value: TreasuryTab; label: string; gridId: string }[] = [
  {
    value: "movements",
    label: "treasury.tabs.bankMovements",
    gridId: "transactionsGrid",
  },
  {
    value: "accounts",
    label: "treasury.tabs.bankAccounts",
    gridId: "bankAccountsGrid",
  },
  {
    value: "statements",
    label: "treasury.tabs.statements",
    gridId: "statementsGrid",
  },
]

const STATEMENT_COLORS: Record<StatementStatus, TagColor> = {
  reconciled: "success",
  partially_reconciled: "info",
  imported: "default",
}

interface TransactionsGridProps extends DataGridProps<BankTransactionResource> {
  onAutoMatch?: () => void
  onImport?: () => void
  isMatching?: boolean
}

export const TransactionsGrid = [
  ...createServerDataGrid(
    listTransactions,
    (row: BankTransactionResource) => row,
  ),
  {
    ...withCells(
      (_props, columnId, row: BankTransactionResource): CellContent => {
        switch (columnId) {
          case "transaction_date":
            return formatDate(row.transaction_date)
          case "amount":
            return renderAmount(row.amount, row.currency)
          case "reconciled":
            return row.reconciled
              ? renderTag(t("treasury.status.reconciled"), "success")
              : renderTag(t("treasury.status.toReconcile"), "warning")
          default:
            return nothing
        }
      },
      (_entity: TransactionsGridEntity, api: AppApi) => ({
        onAutoMatch: () => api.notify("#treasury:autoMatch"),
        onImport: () => api.notify("#treasury:importOpen"),
        isMatching: api.getEntity("treasury")!.isMatching,
      }),
    ),

    renderToolbar(props: TransactionsGridProps): TemplateResult {
      return renderGridToolbar({
        ...props,
        searchLabel: "treasury.searchPlaceholder",
        controls: html`<span class="ff-spacer"></span> ${Button.render({
            size: "sm",
            variant: "outline",
            isDisabled: props.isMatching,
            children: html`${Icon.render({ icon: arrowsRotate })}
            ${t(props.isMatching ? "APP.LOADING" : "treasury.actions.autoMatch")}`,
            onClick: () => props.onAutoMatch?.(),
          })}
          ${Button.render({
            size: "sm",
            color: "primary",
            children: html`${Icon.render({ icon: upload })}
            ${t("treasury.modal.title")}`,
            onClick: () => props.onImport?.(),
          })}`,
      })
    },
  },
]

export const BankAccountsGrid = {
  ...createLoadedDataGrid(
    listBankAccounts,
    (account: BankAccountResource) => account,
  ),
  ...withCells((_props, columnId, account: BankAccountResource) =>
    columnId === "balance"
      ? renderAmount(account.balance, account.currency)
      : nothing,
  ),
}

export const StatementsGrid = {
  ...createLoadedDataGrid(
    listStatements,
    (statement: BankStatement) => statement,
  ),
  ...withCells(
    (props, columnId, statement: BankStatement): CellContent => {
      switch (columnId) {
        case "statement_date":
          return formatDate(statement.statement_date)
        case "closing_balance":
          return renderAmount(statement.closing_balance, statement.currency)
        case "status":
          return renderTag(
            t(`treasury.statementStatus.${statement.status}`),
            STATEMENT_COLORS[statement.status] ?? "default",
          )
        case "actions":
          return Button.render({
            size: "sm",
            variant: "ghost",
            ariaLabel: `${t("treasury.actions.reconcile")}: ${statement.iban}`,
            children: t("treasury.actions.reconcile"),
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              props.onReconcile?.(statement)
            },
          })
        default:
          return nothing
      }
    },
    (_entity, api: AppApi) => ({
      onReconcile: ({ id, iban }: BankStatement) =>
        api.notify("#treasury:statementReconcile", { id, iban }),
    }),
  ),
}

/** Every failure is told as one: the Angular page invented data and announced success. */
export const TreasuryPage = [
  {
    // The figures read every grid: all three load when the page opens.
    routeChange: pageRouteChange<TreasuryPageEntity & { id: string }>({
      open: (_entity, _, api) => {
        TABS.forEach(({ gridId }) => api.notify(`#${gridId}:fetch`))
      },
      close: (entity) => {
        entity.isImportOpen = false
      },
    }),

    tabChange(entity: TreasuryPageEntity, tab: TreasuryTab) {
      entity.tab = tab
    },

    ...handleAsync("autoMatch", {
      start(entity: TreasuryPageEntity) {
        entity.isMatching = true
      },
      run: () => autoMatchTransactions(),
      success(_entity: TreasuryPageEntity, _result: unknown, api: AppApi) {
        api.notify("#toast:show", {
          key: "treasury.messages.reconciliationSuccess",
        })
        api.notify("#transactionsGrid:fetch")
      },
      finally(entity: TreasuryPageEntity) {
        entity.isMatching = false
      },
    }),

    ...handleAsync("statementReconcile", {
      run: async ({ id, iban }: { id: string; iban: string }) => {
        await reconcileStatement(id)
        return iban
      },
      success(_entity: TreasuryPageEntity, iban: string, api: AppApi) {
        api.notify("#toast:show", {
          key: "treasury.messages.statementReconciled",
          values: { iban },
        })
        api.notify("#statementsGrid:fetch")
        api.notify("#transactionsGrid:fetch")
      },
    }),

    importOpen(entity: TreasuryPageEntity) {
      entity.isImportOpen = true
    },

    importClose(entity: TreasuryPageEntity) {
      if (!entity.isImporting) entity.isImportOpen = false
    },

    importFormatChange(entity: TreasuryPageEntity, format: ImportFormat) {
      entity.importFormat = format
    },

    // The file goes straight to the request: a File is no state to keep.
    ...handleAsync("import", {
      start(entity: TreasuryPageEntity) {
        entity.isImporting = true
      },
      run: async ({ format, file }: { format: ImportFormat; file: File }) => {
        await importStatement(format, file)
        return format
      },
      success(entity: TreasuryPageEntity, format: ImportFormat, api: AppApi) {
        entity.isImportOpen = false
        api.notify("#toast:show", { key: `treasury.messages.${format}Success` })
        api.notify("#transactionsGrid:fetch")
        api.notify("#statementsGrid:fetch")
      },
      finally(entity: TreasuryPageEntity) {
        entity.isImporting = false
      },
    }),

    render(entity: TreasuryPageEntity, api: AppApi): TemplateResult {
      const accounts = api.getEntity("bankAccountsGrid") as TreasuryGridEntity
      const transactions = api.getEntity(
        "transactionsGrid",
      ) as TransactionsGridEntity
      const balance = (currency: string) =>
        (accounts.rows as unknown as BankAccountResource[])
          .filter((account) => account.currency === currency)
          .reduce(
            (sum, account) => sum + (Number(account.balance) || NO_BALANCE),
            NO_BALANCE,
          )
      const failure = TABS.map(
        ({ gridId }) => api.getEntity(gridId) as TreasuryGridEntity,
      ).find((grid) => grid.failure)?.failure
      const id = entity.id

      return html`
        ${renderPageHeader("treasury.title", "treasury.subtitle")}
        <div class="ff-kpis">
          ${renderKpi("treasury.stats.eurLiquidity", formatMoney(balance("EUR"), "EUR"))}
          ${renderKpi("treasury.stats.chfLiquidity", formatMoney(balance("CHF"), "CHF"))}
          ${renderKpi(
            "treasury.stats.toReconcile",
            transactions.rows.filter((row) => !row.reconciled).length,
            "warning",
          )}
        </div>
        ${when(failure, () => Alert.render({ severity: "error", description: t(failure!) }))}
        ${Card.render({
          children: Tabs.render({
            id: `${id}-tabs`,
            value: entity.tab,
            items: TABS.map(({ value, label, gridId }) => ({
              value,
              label: t(label),
              panel:
                value === entity.tab ? html`${api.render(gridId)}` : undefined,
            })),
            onChange: (tab) =>
              api.notify(`#${id}:tabChange`, tab as TreasuryTab),
          }),
        })}
        ${Dialog.render({
          id: `${id}-import`,
          isOpen: entity.isImportOpen,
          title: t("treasury.modal.title"),
          description: t("treasury.modal.description"),
          closeLabel: t("COMMON.CLOSE"),
          onClose: () => api.notify(`#${id}:importClose`),
          children: html`<div class="ff-form">
            ${RadioGroup.render({
              id: `${id}-format`,
              name: "format",
              label: t("treasury.import.format"),
              value: entity.importFormat,
              options: [
                { value: "camt", label: t("treasury.import.camt") },
                { value: "cbi", label: t("treasury.import.cbi") },
              ],
              onChange: (format) =>
                api.notify(`#${id}:importFormatChange`, format as ImportFormat),
            })}
            ${Button.render({
              color: "primary",
              accept: ".xml,.cbi,.txt,.csv",
              isDisabled: entity.isImporting,
              children: html`${Icon.render({ icon: upload })}
              ${t(entity.isImporting ? "APP.LOADING" : "treasury.import.chooseFile")}`,
              onFileSelect: (files: FileList) => {
                const [file] = files
                if (file)
                  api.notify(`#${id}:import`, {
                    format: entity.importFormat,
                    file,
                  })
              },
            })}
          </div>`,
        })}
      `
    },
  },
  requireAuth,
]

function renderAmount(amount: number, currency: string): TemplateResult {
  return html`<strong
    class=${amount < NO_BALANCE ? "ff-amount-negative" : "ff-amount-positive"}
    >${formatMoney(amount, currency || "EUR")}</strong
  >`
}

export default TreasuryPage
