import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Progress } from "@inglorious/ui/progress"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"

import type { AppApi } from "../../types"
import { t } from "../i18n"

/**
 * The page the route names. A page loads on its first visit: a bar shows
 * meanwhile, and a failed load (such as a deploy that replaced its chunk)
 * says so with a retry rather than leaving the previous page up.
 */
export function renderRoute(api: AppApi): TemplateResult {
  const { route, path, isLoading, error } = api.getEntity("router")!

  if (error) {
    return Alert.render({
      severity: "error",
      description: t("APP.PAGE_LOAD_FAILED"),
      action: Button.render({
        size: "sm",
        children: t("APP.RETRY"),
        onClick: () =>
          api.notify("#router:navigate", { to: path ?? "/", force: true }),
      }),
    })
  }

  return html`${when(isLoading, () =>
    Progress.render({ variant: "linear", ariaLabel: t("APP.LOADING") }),
  )}
  ${route ? api.render(route) : nothing}`
}
