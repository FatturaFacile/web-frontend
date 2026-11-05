import { html } from "@inglorious/web"

import { listTickets } from "../../api/field-service"
import { fromAntColor, renderTag } from "../../layout/tag"
import type { FieldServiceTicket } from "../../models/field-service"
import { createListPage } from "../../types/list-page"

export const FieldServicePage = createListPage(
  listTickets,
  (columnId, ticket: FieldServiceTicket) => {
    switch (columnId) {
      case "id":
        return html`<strong>${ticket.id}</strong>`
      case "sla":
        return html`<code>${ticket.sla}</code>`
      case "status":
        return renderTag(ticket.status, fromAntColor(ticket.color))
    }
  },
)

export default FieldServicePage
