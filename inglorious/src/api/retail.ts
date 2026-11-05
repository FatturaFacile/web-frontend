import type { ListResponse } from "../models/api"
import type { RetailSession } from "../models/retail"
import { http } from "./http"
import { toPage } from "./page"

export async function listSessions(): Promise<RetailSession[]> {
  return toPage(await http.get<ListResponse<RetailSession>>("/retail/sessions"))
    .items
}
