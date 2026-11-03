import {
  DataGrid,
  type DataGridProps,
  type Row,
} from "@inglorious/ui/data-grid"
import { Progress } from "@inglorious/ui/progress"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"

import type { AppApi } from "../../../types"
import { t } from "../../i18n"

const NO_ROWS = 0

/** What a cell shows in place of its value, or `nothing` to show the value. */
export type CellContent = TemplateResult | string | typeof nothing

interface GridEntity<TRow extends Row> extends DataGridProps<TRow> {
  id?: string
  isLoading?: boolean
  failure?: unknown
}

interface CellPayload<TRow> {
  cell: unknown
  index: number
  row?: TRow
}

/**
 * How a grid of the app renders: column titles are translation keys, a bar
 * shows while it loads, a line says when there is nothing, and
 * `renderContent` gives the cells that show more than their value. The props
 * `callbacks` returns reach `renderContent` and the grid's sub-renderers, for
 * a row's buttons to notify the page.
 */
export function withCells<
  TRow extends Row,
  TEntity extends GridEntity<TRow>,
  TCallbacks extends object = object,
>(
  renderContent: (
    props: DataGridProps<TRow> & Partial<TCallbacks>,
    columnId: string,
    row: TRow,
  ) => CellContent,
  callbacks?: (entity: TEntity, api: AppApi) => TCallbacks,
) {
  return {
    render(entity: TEntity, api: AppApi): TemplateResult {
      const props = {
        ...entity,
        columns: entity.columns.map((column) => ({
          ...column,
          title: t(column.title),
        })),
        ...callbacks?.(entity, api),
      }

      return html`
        ${when(entity.isLoading, () =>
          Progress.render({ variant: "linear", ariaLabel: t("APP.LOADING") }),
        )}
        ${DataGrid.render.call(this, props, api)}
        ${when(
          !entity.isLoading &&
            !entity.failure &&
            entity.rows.length === NO_ROWS,
          () => html`<p class="ff-empty">${t("APP.EMPTY")}</p>`,
        )}
      `
    },

    renderCell(
      props: DataGridProps<TRow> & Partial<TCallbacks>,
      payload: CellPayload<TRow>,
    ): TemplateResult {
      const column = props.columns[payload.index]
      const content = payload.row
        ? renderContent(props, column.id, payload.row)
        : nothing

      return DataGrid.renderCell.call(
        this,
        props,
        content === nothing ? payload : { ...payload, cell: content },
      )
    },
  }
}
