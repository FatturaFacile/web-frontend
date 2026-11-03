import type { ListResponse } from "../models/api"
import type { FieldServiceTicket } from "../models/field-service"
import { http } from "./http"
import { toPage } from "./page"

export async function listTickets(): Promise<FieldServiceTicket[]> {
  return toPage(
    await http.get<ListResponse<FieldServiceTicket>>("/field-service/tickets"),
  ).items
}
