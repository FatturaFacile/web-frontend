import { html } from "@inglorious/web"

import { listConstructionSites } from "../../api/construction"
import { renderTag } from "../../layout/tag"
import type { ConstructionSite } from "../../models/construction"
import { createListPage } from "../../types/list-page"

export const ConstructionPage = createListPage(
  listConstructionSites,
  (columnId, site: ConstructionSite) => {
    switch (columnId) {
      case "code":
      case "sal":
        return html`<strong>${site[columnId]}</strong>`
      case "location":
        return renderTag(
          `${site.location} (${site.regime})`,
          site.regime === "CH" ? "error" : "info",
        )
      case "norm":
        return renderTag(site.norm, "success")
    }
  },
)

export default ConstructionPage
