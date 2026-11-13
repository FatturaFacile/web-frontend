export interface TenantSettings {
  id: string;
  name: string;
  legal_name?: string | null;
  fiscal_code?: string | null;
  vat_number?: string | null;
  uid_number?: string | null;
  default_currency: string;
  iban?: string | null;
  qr_iban?: string | null;
  sdi_code?: string | null;
  pec_email?: string | null;
  settings?: Record<string, unknown> | null;
}

export type UpdateTenantSettingsPayload = Partial<TenantSettings>;

export interface BranchResource {
  id: string;
  tenant_id: string | null;
  name: string;
  code: string;
  address?: string | null;
  is_primary: boolean;
}

export interface UserResource {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

export interface RoleResource {
  id: string;
  name: string;
  permissions: string[];
  description?: string | null;
}

export interface AuditLogResource {
  id: string;
  user_id?: string | null;
  user?: { id: string; name: string } | null;
  event: string;
  action: string;
  module_code: string;
  auditable_type: string;
  auditable_id: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  event_timestamp: string;
}

export interface TenantPreferences {
  language: string;
  timezone: string;
  date_format: string;
  invoice_prefix: string;
  default_vat_rate: number;
}

export interface TenantMemberTwoFactorStatus {
  id: string;
  name: string;
  email: string;
  role: string | null;
  two_factor_enabled: boolean;
}

export interface TwoFactorPolicyResponse {
  require_two_factor: boolean;
  members: TenantMemberTwoFactorStatus[];
}

export interface UpdateTwoFactorPolicyPayload {
  require_two_factor: boolean;
}

export interface ResetUserTwoFactorResponse {
  user_id: string;
  two_factor_enabled: boolean;
}
