import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { LoadStatus } from "@inglorious/ui/load-status"
import { Table, type TableColumn, type TableProps } from "@inglorious/ui/table"
import { html, type TemplateResult } from "@inglorious/web"
import { pageRouteChange } from "@inglorious/web/router"

import type { AppApi, ListPageEntity } from "../../../types"
import { describeLoadFailure } from "../../api/http"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { renderPageHeader } from "../../layout/page-header"

type Row = Record<string, unknown>

/** What a cell shows instead of its raw value, or undefined to show the value. */
export type CellRenderer<T> = (
  columnId: string,
  row: T,
) => TemplateResult | string | undefined

interface CellPayload {
  column: TableColumn
  row: Row
  index: number
  columnIndex: number
}

/**
 * A page that shows one card with one table, loaded each time the page opens:
 * the Angular sections that list what a single endpoint returns. The page's
 * entity holds the translation keys and the columns; `renderCell` adds what a
 * column shows beyond its value, such as a tag.
 */
export function createListPage<T extends object>(
  load: () => Promise<T[]>,
  renderCell: CellRenderer<T> = () => undefined,
) {
  const ListTable = {
    ...Table,
    renderCell(props: TableProps, payload: CellPayload) {
      const content = renderCell(payload.column.id, payload.row as T)
      if (content === undefined) return Table.renderCell(props, payload)

      return Table.renderCell(props, {
        ...payload,
        row: { ...payload.row, [payload.column.id]: content },
      })
    },
  }

  return [
    {
      routeChange: pageRouteChange<ListPageEntity & { id: string }>({
        open: (entity, _, api) => api.notify(`#${entity.id}:fetch`),
      }),

      ...handleAsync("fetch", {
        start(entity: ListPageEntity) {
          entity.isLoading = true
          entity.failure = null
        },

        run: () => load(),

        success(entity: ListPageEntity, rows: T[]) {
          entity.rows = rows as Row[]
        },

        error(entity: ListPageEntity, error: unknown) {
          entity.rows = []
          entity.failure = describeLoadFailure(error)
        },

        finally(entity: ListPageEntity) {
          entity.isLoading = false
        },
      }),

      render(entity: ListPageEntity, api: AppApi): TemplateResult {
        const { failure } = entity

        return html`
          ${renderPageHeader(entity.titleKey, entity.subtitleKey)}
          ${Card.render({
            title: t(entity.cardTitleKey),
            children: LoadStatus.render({
              isLoading: entity.isLoading,
              loadingLabel: t("APP.LOADING"),
              isError: Boolean(failure),
              error: Alert.render({
                severity: "error",
                description: failure ? t(failure) : "",
                action: Button.render({
                  size: "sm",
                  children: t("APP.RETRY"),
                  onClick: () => api.notify(`#${entity.id}:fetch`),
                }),
              }),
              isEmpty: !entity.rows.length,
              emptyText: t("APP.EMPTY"),
              content: () =>
                ListTable.render({
                  columns: entity.columns.map((column) => ({
                    ...column,
                    label: t(column.title),
                  })),
                  rows: entity.rows,
                  isFullWidth: true,
                }),
            }),
          })}
        `
      },
    },
    requireAuth,
  ]
}
