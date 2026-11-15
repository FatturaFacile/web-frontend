/** Platform administration: tenant access requests and document quota (`/admin/*`). */

export type TenantAccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TenantAccessRequestRecord {
  id: string;
  status: TenantAccessRequestStatus | string;
  requested_company_name: string;
  requested_tax_id: string;
  requested_country: string;
  tenant: Record<string, unknown> | null;
  user: { id: string; name: string; email: string; email_verified_at: string | null };
  decided_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  created_at: string | null;
}

export interface TenantAccessDecisionPayload {
  role?: string | null;
  tenant_id?: string;
  reason?: string | null;
}

export interface DocumentQuotaState {
  enabled: boolean;
  limit: string | null;
  used: string;
  remaining: string | null;
  year: number | null;
}

/** A user of the platform, listed by `GET /admin/users`. */
export interface PlatformUserRecord {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

export interface PlatformTenantRecord {
  id: string;
  name: string;
}

/** Access of a user to one tenant (`GET /admin/users/{id}/tenants`). */
export interface UserTenantAccess {
  tenant_id: string;
  tenant_name: string;
  role: string;
  suspended: boolean;
  permissions: string[];
  modules: Record<string, 'default' | 'blocked' | 'read' | 'write'>;
}
