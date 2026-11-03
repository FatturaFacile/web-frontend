import { describe, expect, it } from "vitest"

import { toPage } from "./page"

const rows = [{ id: "1" }, { id: "2" }]

describe("toPage", () => {
  it("reads the documented shape: rows in data, count in meta", () => {
    expect(
      toPage({
        success: true,
        message: "",
        data: rows,
        meta: { total: 42, per_page: 10 },
      }),
    ).toEqual({ items: rows, total: 42, perPage: 10 })
  })

  it("reads a Laravel paginator nested in data, as /crm/contacts sends it", () => {
    expect(
      toPage({
        success: true,
        message: "Contacts retrieved successfully",
        data: {
          current_page: 1,
          data: rows,
          first_page_url: "/crm/contacts?page=1",
          from: 1,
          last_page: 1,
          last_page_url: "/crm/contacts?page=1",
          links: [],
          next_page_url: null,
          path: "/crm/contacts",
          per_page: 25,
          prev_page_url: null,
          to: 2,
          total: 7,
        },
      }),
    ).toEqual({ items: rows, total: 7, perPage: 25 })
  })

  it("counts the rows when nothing else does", () => {
    expect(toPage({ success: true, message: "", data: rows })).toEqual({
      items: rows,
      total: 2,
    })
  })

  it("reads no rows from an empty answer", () => {
    expect(toPage({ success: true, message: "", data: null as never })).toEqual(
      { items: [], total: 0 },
    )
  })
})
