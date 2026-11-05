import type { ListResponse } from "../models/api"
import type { LegalCase } from "../models/professionals"
import { http } from "./http"
import { toPage } from "./page"

export async function listCases(): Promise<LegalCase[]> {
  return toPage(await http.get<ListResponse<LegalCase>>("/professionals/cases"))
    .items
}
