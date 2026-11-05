import type {
  AppApi,
  GuardedFields,
  RouteChangePayload,
  SessionChangePayload,
} from "../../types"
import { HOME_PATH, LOGIN_PATH } from "../config"

type GuardedEntity = { id: string } & Partial<GuardedFields>

type RouteChange = (
  entity: GuardedEntity,
  payload: RouteChangePayload,
  api: AppApi,
) => void

interface Routed {
  routeChange?: RouteChange
}

/** Sends a visitor who is not signed in to the login page, and back after. */
export const requireAuth = <T extends object>(type: T) =>
  guard(type, (entity, payload) =>
    entity.isSignedIn
      ? null
      : `${LOGIN_PATH}?from=${encodeURIComponent(payload.path)}`,
  )

/** Keeps a signed-in user away from the login page. */
export const requireGuest = <T extends object>(type: T) =>
  guard(type, (entity) => (entity.isSignedIn ? HOME_PATH : null))

/**
 * Lets the page hear the route change unless `redirect` names somewhere else.
 *
 * The page keeps its own copy of the session: `api.getEntity("session")` would
 * answer with the state before the current update, so a sign-in followed by a
 * navigation in the same update would still look signed out. While the
 * session is unknown the route is held: the session runs it again once known.
 *
 * A page loaded lazily, after the session was announced, has no copy: it
 * reads the session, which is current by then, since its route change comes
 * in an update of its own once the page has loaded.
 */
function guard(
  type: object,
  redirect: (
    entity: GuardedEntity,
    payload: RouteChangePayload,
  ) => string | null,
) {
  const { routeChange } = type as Routed

  return {
    sessionChange(entity: GuardedEntity, session: SessionChangePayload) {
      entity.isSessionKnown = session.isKnown
      entity.isSignedIn = session.isSignedIn
    },

    routeChange(
      entity: GuardedEntity,
      payload: RouteChangePayload,
      api: AppApi,
    ) {
      if (payload.route === entity.id) {
        const session =
          entity.isSessionKnown === undefined ? readSession(api) : entity
        if (!session.isSessionKnown) return

        const to = redirect({ ...entity, ...session }, payload)
        if (to) {
          api.notify("#router:navigate", { to, replace: true })
          return
        }
      }
      routeChange?.(entity, payload, api)
    },
  }
}

function readSession(api: AppApi): GuardedFields {
  const { status, user } = api.getEntity("session")!
  return { isSessionKnown: status !== "checking", isSignedIn: Boolean(user) }
}
