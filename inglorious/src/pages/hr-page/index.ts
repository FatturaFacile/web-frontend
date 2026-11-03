import { html } from "@inglorious/web"

import { listEmployees } from "../../api/hr"
import { renderTag } from "../../layout/tag"
import type { Employee } from "../../models/hr"
import { createListPage } from "../../types/list-page"

export const HrPage = createListPage(
  listEmployees,
  (columnId, employee: Employee) => {
    switch (columnId) {
      case "name":
        return html`<strong>${employee.name}</strong>`
      case "regime":
        return renderTag(
          employee.regime,
          employee.regime.includes("Frontaliere") ? "secondary" : "info",
        )
      case "status":
        return renderTag(employee.status, "success")
    }
  },
)

export default HrPage
