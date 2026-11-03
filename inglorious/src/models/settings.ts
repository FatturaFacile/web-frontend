export interface TenantSettings {
  id: string
  name: string
  legal_name?: string | null
  fiscal_code?: string | null
  vat_number?: string | null
  uid_number?: string | null
  default_currency: string
  iban?: string | null
  qr_iban?: string | null
  sdi_code?: string | null
  pec_email?: string | null
}

export interface BranchResource {
  id: string
  name: string
  code: string
  address: string
  city: string
  country: string
  is_headquarters: boolean
}

export interface UserResource {
  id: string
  name: string
  email: string
  role: string
  roles: string[]
  is_active: boolean
  last_login_at?: string | null
}

export interface RoleResource {
  id: string
  name: string
  permissions: string[]
  description?: string | null
}

export interface AuditLogResource {
  id: string
  user_name?: string | null
  event: string
  auditable_type: string
  auditable_id: string
  ip_address?: string | null
  created_at: string
}
