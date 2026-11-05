import { Card } from "@inglorious/ui/card"
import { html } from "@inglorious/web"

import { requireAuth } from "../../guards"
import { t } from "../../i18n"

/** Every route of the Angular app that has not been moved here yet. */
export const NotPortedPage = [
  {
    render() {
      return Card.render({
        title: t("APP.NOT_PORTED_TITLE"),
        children: html`<p>${t("APP.NOT_PORTED_BODY")}</p>`,
      })
    },
  },
  requireAuth,
]
