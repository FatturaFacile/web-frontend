import { handleAsync } from "@inglorious/store/async"
import type { NavigatePayload } from "@inglorious/web/router"

import type { AppApi, SessionEntity, SessionType } from "../../../types"
import { AUTH_PATHS, getProfile, signOut, switchTenant } from "../../api/auth"
import { setTenantId } from "../../api/http"
import { LOGIN_PATH } from "../../config"
import type { UserProfile } from "../../models/user"

const UNAUTHORIZED = 401

export const Session: SessionType = {
  // Asks the backend whether the browser already has a session, as the
  // Angular auth guard did on first navigation.
  init(entity, _, api) {
    entity.status = "checking"
    entity.user = null

    const { id } = entity
    getProfile().then(
      (response) => api.notify(`#${id}:checkSuccess`, response.data),
      () => api.notify(`#${id}:checkSuccess`, null),
    )
  },

  checkSuccess(entity, user, api) {
    entity.status = "ready"
    entity.user = user
    announce(api, user)
    // The guards held the first route while the session was unknown: run it again.
    api.notify("#router:navigate", rerunCurrentRoute())
  },

  signIn(entity, user, api) {
    entity.user = user
    announce(api, user)
  },

  signOut(entity, _, api) {
    entity.user = null
    announce(api, null)
    setTenantId(null)
    signOut().catch(() => {
      // Already toasted; the local session is gone either way.
    })
    api.notify("#router:navigate", { to: LOGIN_PATH, replace: true })
  },

  // The backend changes the session's tenant; the profile then says which it is.
  ...handleAsync("tenantSwitch", {
    async run(tenantId: string): Promise<UserProfile> {
      await switchTenant(tenantId)
      setTenantId(tenantId)
      return (await getProfile()).data
    },

    success(entity: SessionEntity, user: UserProfile, api: AppApi) {
      entity.user = user
      announce(api, user)
      // The page shows the other tenant's data once it loads it again.
      api.notify("#router:navigate", rerunCurrentRoute())
    },
  }),

  requestFail(entity, error, api) {
    if (error.status !== UNAUTHORIZED || AUTH_PATHS.includes(error.path)) {
      return
    }
    if (!entity.user) return

    entity.user = null
    announce(api, null)
    const from = encodeURIComponent(location.pathname + location.search)
    api.notify("#router:navigate", {
      to: `${LOGIN_PATH}?from=${from}`,
      replace: true,
    })
    api.notify("#toast:show", { key: "ERRORS.SESSION_EXPIRED" })
  },
}

/**
 * Tells the guarded pages before any navigation that follows: during this
 * update they would read the session as it was before it.
 */
function announce(api: AppApi, user: UserProfile | null) {
  api.notify("sessionChange", { isKnown: true, isSignedIn: Boolean(user) })
  if (!user) {
    api.notify("#i18n:userLocaleClear")
    return
  }

  // The user's language, unless they picked one before signing in.
  api.notify("#i18n:userLocaleLoad", {
    userId: user.id,
    locale: user.locale ?? null,
  })

  const tenant = user.active_tenant
  if (tenant) setTenantId(tenant.id)
  if (tenant?.country === "IT" || tenant?.country === "CH") {
    api.notify("#workspace:jurisdictionChange", tenant.country)
  }
}

function rerunCurrentRoute(): NavigatePayload {
  return { to: location.pathname + location.search, replace: true, force: true }
}
