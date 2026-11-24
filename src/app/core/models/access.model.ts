import { MemberModuleLevels, ModuleAccessLevel } from './settings.model';

/** Users, roles, teams, delegations, invitations and plan limits of the active company (`/settings/access/*`). */

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface InvitationRecord {
  id: string;
  email: string;
  role: string;
  custom_role_id: string | null;
  modules: MemberModuleLevels | null;
  team_ids: string[];
  status: InvitationStatus;
  invited_by: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  last_sent_at: string | null;
  created_at: string | null;
}

export interface SaveInvitationPayload {
  email: string;
  role?: string;
  custom_role_id?: string | null;
  modules?: MemberModuleLevels;
  team_ids?: string[];
}

export type ImportRowStatus = 'created' | 'invited' | 'would_add' | 'would_invite' | 'skipped' | 'error';

export interface ImportRow {
  line: number;
  email: string;
  status: ImportRowStatus;
  message: string | null;
}

export interface ImportReport {
  dry_run: boolean;
  total: number;
  created: number;
  invited: number;
  skipped: number;
  errors: number;
  rows: ImportRow[];
}

export interface CustomRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  base_role: string;
  modules: MemberModuleLevels;
  members: number;
}

export interface CustomRolesResponse {
  roles: CustomRole[];
  base_roles: string[];
  modules: string[];
  levels: ModuleAccessLevel[];
}

export interface SaveCustomRolePayload {
  name?: string;
  description?: string | null;
  base_role?: string;
  modules?: MemberModuleLevels;
}

export interface MatrixAccess {
  read: boolean;
  write: boolean;
}

export interface MatrixRole {
  key: string;
  id?: string;
  name: string;
  custom: boolean;
  base_role: string;
  access: Record<string, MatrixAccess>;
}

export interface AccessMatrix {
  modules: string[];
  roles: MatrixRole[];
}

export interface AccessTeam {
  id: string;
  name: string;
  description: string | null;
  custom_role_id: string | null;
  member_ids: string[];
}

export interface SaveTeamPayload {
  name?: string;
  description?: string | null;
  custom_role_id?: string | null;
}

export type DelegationStatus = 'active' | 'scheduled' | 'expired' | 'revoked';

export interface DelegationParty {
  id: string;
  name: string;
  email: string;
}

export interface DelegationRecord {
  id: string;
  delegator: DelegationParty;
  delegate: DelegationParty;
  role: string;
  modules: string[] | null;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  status: DelegationStatus;
}

export interface SaveDelegationPayload {
  delegate_id: string;
  delegator_id?: string;
  starts_at: string;
  ends_at: string;
  modules?: string[];
  reason?: string;
}

/** `null` means unlimited. */
export interface PlanLimits {
  plan_code: string;
  plans?: unknown;
  max_users: number | null;
  active_users: number;
  pending_invitations: number;
  max_custom_roles: number | null;
  custom_roles: number;
}

export interface UpdateTenantPlanPayload {
  plan_code?: string;
  max_users?: number | null;
  max_custom_roles?: number | null;
}

export const PLAN_CODES = ['starter', 'standard', 'professional', 'enterprise'] as const;

export type AccessAuditType =
  | 'access.member'
  | 'access.role'
  | 'access.team'
  | 'access.delegation'
  | 'access.invitation'
  | 'access.import'
  | 'access.plan';

export const ACCESS_AUDIT_TYPES: readonly AccessAuditType[] = [
  'access.member',
  'access.role',
  'access.team',
  'access.delegation',
  'access.invitation',
  'access.import',
  'access.plan',
];

export interface AccessAuditEvent {
  id: string;
  event: string;
  type: AccessAuditType;
  subject_id: string | null;
  actor: { id: string; name: string; email: string } | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface InvitationPreview {
  email: string;
  tenant_name: string;
  role: string;
  has_account: boolean;
  expires_at: string | null;
}

export interface AcceptInvitationPayload {
  name: string;
  password: string;
  password_confirmation: string;
}

export interface AcceptInvitationResult {
  email: string;
  tenant_name: string;
}
