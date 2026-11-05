import { LoadStatus } from "@inglorious/ui/load-status"
import { html } from "@inglorious/web"
import { choose } from "@inglorious/web/directives/choose"

import type { AppApi } from "../types"
import { t } from "./i18n"
import { renderRoute } from "./layout/route-outlet"

export const App = {
  render(api: AppApi) {
    const { themePreference } = api.getEntity("shell")!
    const { matches: isSystemDark } = api.getEntity("prefersDark")!
    const theme =
      themePreference === "system"
        ? isSystemDark
          ? "dark"
          : "light"
        : themePreference
    const { status, user } = api.getEntity("session")!

    // The theme classes sit here rather than on <body>, so a theme change is a render.
    return html`<div
      class="ff-app iw-theme-bootstrap iw-theme-fatturafacile iw-theme-${theme}"
    >
      ${choose(
        status === "checking" ? "checking" : user ? "signedIn" : "signedOut",
        [
          [
            "checking",
            () =>
              LoadStatus.render({
                isLoading: true,
                loadingLabel: t("APP.LOADING"),
              }),
          ],
          ["signedIn", () => api.render("shell")],
          ["signedOut", () => renderRoute(api)],
        ],
      )}
      ${api.render("toast")}
    </div>`
  },
}
