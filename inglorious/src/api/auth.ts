import type { ApiResponse } from "../models/api"
import type { UserProfile } from "../models/user"
import { fetchCsrfCookie, http } from "./http"

export interface Credentials {
  email: string
  password: string
  remember: boolean
}

export interface SignInResult {
  user?: UserProfile
  tenant_id?: string
}

/** Requests that answer for themselves: a 401 there is not an expired session. */
export const AUTH_PATHS = ["/auth/login", "/auth/profile"]

export async function signIn(
  credentials: Credentials,
): Promise<ApiResponse<SignInResult>> {
  await fetchCsrfCookie()
  return http.post("/auth/login", credentials)
}

export const signOut = () => http.post<ApiResponse<unknown>>("/auth/logout")

export const switchTenant = (tenantId: string) =>
  http.post<ApiResponse<unknown>>("/auth/switch-tenant", {
    tenant_id: tenantId,
  })

export const getProfile = () =>
  http.get<ApiResponse<UserProfile>>("/auth/profile")
