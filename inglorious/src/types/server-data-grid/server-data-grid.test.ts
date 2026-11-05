import { createMockApi, trigger } from "@inglorious/store/test"
import { describe, expect, it, vi } from "vitest"

import type { Page } from "../../models/api"
import { createServerDataGrid } from "."

interface Item {
  id: string
  name: string
}

function setup(page: Partial<Page<Item>> = {}) {
  const load = vi.fn().mockResolvedValue({
    items: [{ id: "1", name: "Rossi" }],
    total: 42,
    ...page,
  })
  const [ServerDataGrid] = createServerDataGrid(load, (item: Item) => ({
    ...item,
    label: item.name.toUpperCase(),
  }))
  // The handlers, as trigger() calls them on the test's grid entity.
  type Handler = (
    entity: ReturnType<typeof gridEntity>,
    payload?: unknown,
    api?: unknown,
  ) => void
  return { load, grid: ServerDataGrid as unknown as Record<string, Handler> }
}

function gridEntity(overrides = {}) {
  return {
    id: "grid",
    type: "Grid",
    columns: [],
    rows: [],
    totalRows: 0,
    sorts: [],
    filters: {},
    search: { value: "" },
    selection: [],
    isMultiSelect: false,
    pagination: { page: 0, pageSize: 10, pageSizes: [10] },
    requestId: 0,
    isLoading: false,
    failure: null,
    ...overrides,
  }
}

describe("createServerDataGrid", () => {
  it("fetches after a page change, going by the server's total", () => {
    const { grid } = setup()
    const api = createMockApi({})

    const { entity } = trigger(
      gridEntity({ totalRows: 42 }),
      grid.pageChange,
      3,
      api,
    )

    expect(entity.pagination.page).toBe(3)
    expect(api.getEvents()).toEqual([{ type: "#grid:fetch" }])
  })

  it("sends the grid's query with Laravel's 1-based page", () => {
    const { grid, load } = setup()

    trigger(
      gridEntity({
        totalRows: 42,
        pagination: { page: 2, pageSize: 20, pageSizes: [20] },
        sorts: [{ column: "name", direction: "desc" }],
        filters: { type: "supplier" },
        search: { value: "ross" },
      }),
      grid.fetch,
      undefined,
      createMockApi({}),
    )

    expect(load).toHaveBeenCalledWith({
      type: "supplier",
      page: 3,
      per_page: 20,
      search: "ross",
      sort_by: "name",
      sort_dir: "desc",
    })
  })

  it("maps the loaded page into rows and the server's total", async () => {
    const { grid } = setup()
    const api = createMockApi({})

    const { entity } = trigger(gridEntity(), grid.fetch, undefined, api)
    expect(entity.isLoading).toBe(true)
    await vi.waitFor(() => expect(api.getEvents()).toHaveLength(1))

    const [{ type, payload }] = api.getEvents()
    expect(type).toBe("#grid:fetchSuccess")

    const { entity: loaded } = trigger(entity, grid.fetchSuccess, payload)
    expect(loaded.rows).toEqual([{ id: "1", name: "Rossi", label: "ROSSI" }])
    expect(loaded.totalRows).toBe(42)
    expect(loaded.isLoading).toBe(false)
  })

  it("drops the answer to a query that was superseded", () => {
    const { grid } = setup()

    const { entity } = trigger(
      gridEntity({ requestId: 2, isLoading: true }),
      grid.fetchSuccess,
      { requestId: 1, rows: [{ id: "old" }], totalRows: 1 },
    )

    expect(entity.rows).toEqual([])
    expect(entity.isLoading).toBe(true)
  })

  it("only notifies from the debounced step, never mutates", () => {
    const { grid } = setup()
    const api = createMockApi({})

    const { entity } = trigger(gridEntity(), grid.searchChange, "ros", api)

    expect(entity.search.value).toBe("ros")
    expect(entity.pagination.page).toBe(0)
    expect(api.getEvents()).toEqual([{ type: "#grid:searchSettle" }])
  })

  it("pages as the server does when it ignores the size asked", () => {
    const { grid } = setup()

    const { entity } = trigger(
      gridEntity({ requestId: 1 }),
      grid.fetchSuccess,
      {
        requestId: 1,
        rows: [],
        totalRows: 30,
        perPage: 25,
      },
    )

    expect(entity.pagination.pageSize).toBe(25)
    expect(entity.pagination.pageSizes).toEqual([10, 25])
  })
})
