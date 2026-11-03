import type { ApiResponse, ListResponse } from "../models/api"
import type {
  AuditLogResource,
  BranchResource,
  RoleResource,
  TenantSettings,
  UserResource,
} from "../models/settings"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/settings"

export const getTenantSettings = () =>
  http.get<ApiResponse<TenantSettings>>(`${PATH}/tenant`)

export const updateTenantSettings = (payload: Partial<TenantSettings>) =>
  http.put<ApiResponse<TenantSettings>>(`${PATH}/tenant`, payload)

export const syncExchangeRates = () =>
  http.post<ApiResponse<{ synced_count: number }>>(
    `${PATH}/exchange-rates/sync`,
    {},
  )

export const listBranches = () => listOf<BranchResource>("branches")
export const listUsers = () => listOf<UserResource>("users")
export const listRoles = () => listOf<RoleResource>("roles")
export const listAuditLogs = () => listOf<AuditLogResource>("audit-logs")

async function listOf<T>(resource: string): Promise<T[]> {
  return toPage(await http.get<ListResponse<T>>(`${PATH}/${resource}`)).items
}
