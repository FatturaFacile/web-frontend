import { createMockApi, trigger } from "@inglorious/store/test"
import { describe, expect, it, vi } from "vitest"

import { HOME_PATH } from "../config"
import { requireAuth, requireGuest } from "."

const payload = {
  route: "clients",
  path: "/crm/clients",
  params: {},
  query: {},
}

function page(session: { isSessionKnown?: boolean; isSignedIn?: boolean }) {
  return { id: "clients", type: "ClientsPage", ...session }
}

function session(status: "checking" | "signedIn" | "signedOut") {
  const user = status === "signedIn" ? { id: "u1", name: "Marco" } : null
  return { session: { type: "Session", status, user } }
}

describe("requireAuth", () => {
  it("holds the route while the session is unknown", () => {
    const routeChange = vi.fn()
    const api = createMockApi(session("checking"))

    trigger(page({}), requireAuth({ routeChange }).routeChange, payload, api)

    expect(routeChange).not.toHaveBeenCalled()
    expect(api.getEvents()).toEqual([])
  })

  it("sends a visitor to the login page, remembering where to", () => {
    const routeChange = vi.fn()
    const api = createMockApi({})

    trigger(
      page({ isSessionKnown: true, isSignedIn: false }),
      requireAuth({ routeChange }).routeChange,
      payload,
      api,
    )

    expect(routeChange).not.toHaveBeenCalled()
    expect(api.getEvents()).toEqual([
      {
        type: "#router:navigate",
        payload: { to: "/login?from=%2Fcrm%2Fclients", replace: true },
      },
    ])
  })

  it("lets a signed-in user through", () => {
    const routeChange = vi.fn()

    trigger(
      page({ isSessionKnown: true, isSignedIn: true }),
      requireAuth({ routeChange }).routeChange,
      payload,
      createMockApi({}),
    )

    expect(routeChange).toHaveBeenCalledOnce()
  })

  // A sign-in and the navigation after it happen in one update, where
  // `api.getEntity("session")` still answers signed out.
  it("hears a sign-in before the navigation that follows it", () => {
    const routeChange = vi.fn()
    const guarded = requireAuth({ routeChange })

    const { entity } = trigger(page({}), guarded.sessionChange, {
      isKnown: true,
      isSignedIn: true,
    })
    trigger(entity, guarded.routeChange, payload, createMockApi({}))

    expect(routeChange).toHaveBeenCalledOnce()
  })

  // A page loaded lazily, after the session was announced, never heard it.
  it("reads the session on a page that missed its announcement", () => {
    const routeChange = vi.fn()

    trigger(
      page({}),
      requireAuth({ routeChange }).routeChange,
      payload,
      createMockApi(session("signedIn")),
    )

    expect(routeChange).toHaveBeenCalledOnce()
  })

  it("passes on changes to other routes, so pages can close", () => {
    const routeChange = vi.fn()
    const api = createMockApi({})

    trigger(
      { ...page({}), id: "suppliers" },
      requireAuth({ routeChange }).routeChange,
      payload,
      api,
    )

    expect(routeChange).toHaveBeenCalledOnce()
    expect(api.getEvents()).toEqual([])
  })
})

describe("requireGuest", () => {
  it("sends a signed-in user home", () => {
    const api = createMockApi({})

    trigger(
      {
        id: "login",
        type: "LoginPage",
        isSessionKnown: true,
        isSignedIn: true,
      },
      requireGuest({}).routeChange,
      { ...payload, route: "login", path: "/login" },
      api,
    )

    expect(api.getEvents()).toEqual([
      {
        type: "#router:navigate",
        payload: { to: HOME_PATH, replace: true },
      },
    ])
  })
})
