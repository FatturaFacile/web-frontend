import { html } from "@inglorious/web"

import { listSessions } from "../../api/retail"
import { renderTag } from "../../layout/tag"
import type { RetailSession } from "../../models/retail"
import { createListPage } from "../../types/list-page"

export const RetailPage = createListPage(
  listSessions,
  (columnId, session: RetailSession) => {
    switch (columnId) {
      case "pos":
      case "total":
        return html`<strong>${session[columnId]}</strong>`
      case "regime":
        return renderTag(
          session.regime,
          session.regime === "IT" ? "info" : "error",
        )
      case "status":
        return renderTag(session.status, "success")
    }
  },
)

export default RetailPage
