/** `GET /auth/profile`'s user (checked against a real response). */
export interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string | null
  /** The language the user last chose, such as `it`. */
  locale?: string | null
  is_active?: boolean
  active_tenant?: ActiveTenant | null
  tenants?: TenantMembership[]
}

export interface TenantMembership {
  id: string
  name: string
  role: string
  /** Not always sent for the tenants one can switch to. */
  country?: string | null
}

export interface ActiveTenant extends TenantMembership {
  /** ISO country: `IT` or `CH` set the jurisdiction. */
  country: string
}
