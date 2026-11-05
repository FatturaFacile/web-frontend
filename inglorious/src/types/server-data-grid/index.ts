import type { Message } from "@inglorious/i18n"
import type { BaseEntity } from "@inglorious/store"
import {
  DataGrid,
  type DataGridProps,
  type Row,
} from "@inglorious/ui/data-grid"
import type { Api } from "@inglorious/web"
import { withDebounce } from "@inglorious/web/decorators/with-debounce"

import type { ServerDataGridFields } from "../../../types"
import { describeLoadFailure } from "../../api/http"
import type { ListQuery, Page } from "../../models/api"

const SEARCH_DEBOUNCE_MS = 300
// The grid counts pages from 0, Laravel from 1.
const PAGE_OFFSET = 1

type ServerDataGridEntity = BaseEntity & DataGridProps & ServerDataGridFields

interface FetchResult {
  requestId: number
  rows: Row[]
  totalRows: number
  perPage?: number
}

/**
 * A DataGrid whose rows come from a paginated Laravel endpoint. Every handler
 * that changes the query fetches after it; `totalRows: 0` keeps the grid in
 * server mode until the first page arrives.
 */
export function createServerDataGrid<TItem, TRow extends Row>(
  load: (query: ListQuery) => Promise<Page<TItem>>,
  toRow: (item: TItem) => TRow,
) {
  const ServerDataGrid = {
    ...DataGrid,

    create(entity: ServerDataGridEntity) {
      DataGrid.create(entity)
      entity.totalRows ??= 0
      entity.requestId ??= 0
      entity.isLoading ??= false
      entity.failure ??= null
    },

    pageChange(entity: ServerDataGridEntity, page: number, api: Api) {
      DataGrid.pageChange(entity, page)
      api.notify(`#${entity.id}:fetch`)
    },

    pageNext(entity: ServerDataGridEntity, _: void, api: Api) {
      DataGrid.pageNext(entity)
      api.notify(`#${entity.id}:fetch`)
    },

    pagePrev(entity: ServerDataGridEntity, _: void, api: Api) {
      DataGrid.pagePrev(entity)
      api.notify(`#${entity.id}:fetch`)
    },

    pageSizeChange(entity: ServerDataGridEntity, pageSize: number, api: Api) {
      DataGrid.pageSizeChange(entity, pageSize)
      api.notify(`#${entity.id}:fetch`)
    },

    sortChange(entity: ServerDataGridEntity, columnId: string, api: Api) {
      DataGrid.sortChange(entity, columnId)
      api.notify(`#${entity.id}:fetch`)
    },

    filterChange(
      entity: ServerDataGridEntity,
      payload: { columnId: string; value: unknown },
      api: Api,
    ) {
      DataGrid.filterChange(entity, payload)
      api.notify(`#${entity.id}:fetch`)
    },

    // The field shows every keystroke; the fetch waits for the typing to stop.
    searchChange(entity: ServerDataGridEntity, value: string, api: Api) {
      DataGrid.searchChange(entity, value)
      api.notify(`#${entity.id}:searchSettle`)
    },

    // Debounced, so it gets a read-only entity: it may only notify.
    searchSettle(entity: ServerDataGridEntity, _: void, api: Api) {
      api.notify(`#${entity.id}:fetch`)
    },

    fetch(entity: ServerDataGridEntity, _: void, api: Api) {
      entity.requestId += 1
      entity.isLoading = true
      entity.failure = null

      const { id, requestId } = entity
      load(toQuery(entity)).then(
        (page) =>
          api.notify(`#${id}:fetchSuccess`, {
            requestId,
            rows: page.items.map(toRow),
            totalRows: page.total,
            perPage: page.perPage,
          }),
        (error: unknown) =>
          api.notify(`#${id}:fetchError`, {
            requestId,
            failure: describeLoadFailure(error),
          }),
      )
    },

    // Answers to an older query are dropped, as switchMap did in Angular.
    fetchSuccess(entity: ServerDataGridEntity, result: FetchResult) {
      if (result.requestId !== entity.requestId) return
      entity.rows = result.rows
      entity.totalRows = result.totalRows
      followServerPageSize(entity, result.perPage)
      entity.selection = []
      entity.isLoading = false
    },

    fetchError(
      entity: ServerDataGridEntity,
      result: { requestId: number; failure: Message },
    ) {
      if (result.requestId !== entity.requestId) return
      entity.failure = result.failure
      entity.isLoading = false
    },
  }

  return [ServerDataGrid, withDebounce(SEARCH_DEBOUNCE_MS, ["searchSettle"])]
}

function toQuery(entity: ServerDataGridEntity): ListQuery {
  const [sort] = entity.sorts
  const { page, pageSize } = entity.pagination ?? { page: 0, pageSize: 0 }

  return {
    ...entity.filters,
    page: page + PAGE_OFFSET,
    per_page: pageSize,
    search: entity.search?.value || undefined,
    sort_by: sort?.column,
    sort_dir: sort?.direction,
  }
}

/**
 * Pages are as long as the server makes them: `/crm/contacts` answers 25 rows
 * whatever `per_page` asks, and the grid must count pages the same way.
 */
function followServerPageSize(entity: ServerDataGridEntity, perPage?: number) {
  const { pagination } = entity
  if (!pagination || !perPage || perPage === pagination.pageSize) return

  pagination.pageSize = perPage
  if (!pagination.pageSizes.includes(perPage)) {
    pagination.pageSizes = [...pagination.pageSizes, perPage].sort(
      (a, b) => a - b,
    )
  }
}
