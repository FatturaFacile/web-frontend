import type { BaseEntity } from "@inglorious/store"
import { handleAsync } from "@inglorious/store/async"
import {
  DataGrid,
  type DataGridProps,
  type Row,
} from "@inglorious/ui/data-grid"

import type { LoadedDataGridFields } from "../../../types"
import { describeLoadFailure } from "../../api/http"

type LoadedDataGridEntity = BaseEntity & DataGridProps & LoadedDataGridFields

/**
 * A DataGrid whose rows come from an endpoint that answers with all of them
 * at once: it loads on `fetch`, then sorts and pages them itself, as the
 * Angular tables with front pagination did.
 */
export function createLoadedDataGrid<TItem, TRow extends Row>(
  load: () => Promise<TItem[]>,
  toRow: (item: TItem) => TRow,
) {
  return {
    ...DataGrid,

    create(entity: LoadedDataGridEntity) {
      DataGrid.create(entity)
      entity.isLoading ??= false
      entity.failure ??= null
    },

    ...handleAsync("fetch", {
      start(entity: LoadedDataGridEntity) {
        entity.isLoading = true
        entity.failure = null
      },

      run: async () => (await load()).map(toRow),

      success(entity: LoadedDataGridEntity, rows: TRow[]) {
        entity.rows = rows
        entity.selection = []
        if (entity.pagination) entity.pagination.page = 0
      },

      error(entity: LoadedDataGridEntity, error: unknown) {
        entity.rows = []
        entity.failure = describeLoadFailure(error)
      },

      finally(entity: LoadedDataGridEntity) {
        entity.isLoading = false
      },
    }),
  }
}
