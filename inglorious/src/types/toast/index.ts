import type { Message } from "@inglorious/i18n"
import { Snackbar } from "@inglorious/ui/snackbar"

import type { HttpError, ToastType } from "../../../types"
import { AUTH_PATHS } from "../../api/auth"
import { t } from "../../i18n"

const VISIBLE_FOR_MS = 5000
const NETWORK_FAILURE = 0
const UNAUTHORIZED = 401
const FORBIDDEN = 403
const UNPROCESSABLE = 422
const TOO_MANY_REQUESTS = 429

export const Toast: ToastType = {
  show(entity, message, api) {
    entity.isOpen = true
    entity.message = message
    entity.showCount += 1

    const { id, showCount } = entity
    setTimeout(() => api.notify(`#${id}:expire`, showCount), VISIBLE_FOR_MS)
  },

  // Only the timer of the latest toast closes it.
  expire(entity, showCount) {
    if (showCount === entity.showCount) entity.isOpen = false
  },

  close(entity) {
    entity.isOpen = false
  },

  // What the Angular error interceptors toasted. Expired sessions are the
  // session's, validation errors the forms', sign-in errors the login page's.
  requestFail(entity, error, api) {
    const message = describeFailure(error)
    if (message) api.notify(`#${entity.id}:show`, message)
  },

  render(entity, api) {
    return Snackbar.render({
      isOpen: entity.isOpen,
      message: entity.message ? t(entity.message) : "",
      position: "bottom-center",
      onClose: () => api.notify(`#${entity.id}:close`),
    })
  },
}

function describeFailure(error: HttpError): Message | null {
  if (AUTH_PATHS.includes(error.path)) return null

  switch (error.status) {
    case UNAUTHORIZED:
    case UNPROCESSABLE:
      return null
    case NETWORK_FAILURE:
      return { key: "ERRORS.NETWORK" }
    case FORBIDDEN:
      return error.serverMessage ?? { key: "ERRORS.FORBIDDEN_TITLE" }
    case TOO_MANY_REQUESTS:
      return { key: "ERRORS.TOO_MANY_REQUESTS_DESC" }
    default:
      return (
        error.serverMessage ?? {
          key: "ERRORS.GENERIC",
          values: { status: error.status },
        }
      )
  }
}
