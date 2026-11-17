import { FiscalPreferences } from './tax.model';

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
  /** Customs approved exporter authorisation number (max 50 characters). */
  customs_approved_exporter_number?: string | null;
  /** REX registered exporter number (max 50 characters). */
  rex_exporter_number?: string | null;
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

/** How far a member may use a module: `default` follows the role, `blocked` closes it, `read` and `write` override the role. */
export type ModuleAccessLevel = 'default' | 'blocked' | 'read' | 'write';

/** Module access of a member, only for the modules that are not at the default level. */
export type MemberModuleLevels = Record<string, ModuleAccessLevel>;

export interface UserResource {
  id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  is_active: boolean;
  suspended?: boolean;
  /** Raw permissions of the membership (`deny:crm`, `crm.read`, `gl.*`). */
  permissions?: string[];
  modules?: MemberModuleLevels;
  /** Set when the member holds a custom role; `role` then carries the base system role of that custom role. */
  custom_role_id?: string | null;
  team_ids?: string[];
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
  /** Italian fiscal defaults (issue #286); the API returns `[]` while the group is empty. */
  fiscal?: FiscalPreferences | unknown[];
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

export interface AccessOptions {
  roles: string[];
  modules: string[];
  levels: ModuleAccessLevel[];
}

/** Payload of `POST /settings/users` (`email`) and `PUT /settings/users/{id}`. */
export interface SaveTenantMemberPayload {
  email?: string;
  role?: string;
  /** Wins over `role`; sending `role` alone detaches the member from a custom role. */
  custom_role_id?: string | null;
  modules?: MemberModuleLevels;
}
