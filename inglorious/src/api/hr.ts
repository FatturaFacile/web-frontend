import type { ListResponse } from "../models/api"
import type { Employee } from "../models/hr"
import { http } from "./http"
import { toPage } from "./page"

export async function listEmployees(): Promise<Employee[]> {
  return toPage(await http.get<ListResponse<Employee>>("/hr/employees")).items
}
