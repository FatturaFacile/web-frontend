import type { ListResponse } from "../models/api"
import type { RentalVehicle } from "../models/rent"
import { http } from "./http"
import { toPage } from "./page"

export async function listVehicles(): Promise<RentalVehicle[]> {
  return toPage(await http.get<ListResponse<RentalVehicle>>("/rent/vehicles"))
    .items
}
