import type { ListResponse } from "../models/api"
import type { ConstructionSite } from "../models/construction"
import { http } from "./http"
import { toPage } from "./page"

export async function listConstructionSites(): Promise<ConstructionSite[]> {
  return toPage(
    await http.get<ListResponse<ConstructionSite>>("/construction/sites"),
  ).items
}
