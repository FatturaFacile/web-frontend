/** What a field policy does with a value for the signed-in user. */
export type FieldVisibility = 'visible' | 'masked' | 'hidden';

export type FieldKind = 'amount' | 'iban';

export interface FieldPolicyEntry {
  resource: string;
  field: string;
  visibility: FieldVisibility;
  kind: FieldKind;
}

/** `GET /profile/permissions`: the effective permissions and field policies for the active tenant and company. */
export interface PermissionSnapshot {
  permissions: string[];
  field_policies: FieldPolicyEntry[];
  company_id: string | null;
}

/** Permission keys grouped by module, then resource, with the actions of the resource. */
export type PermissionCatalog = Record<string, Record<string, string[]>>;

export const ABAC_ATTRIBUTES = [
  'contact.owner_id',
  'contact.region',
  'document.total',
  'company_id',
  'context.ip',
  'context.hour',
  'context.weekday',
] as const;

export const ABAC_OPERATORS = ['==', '!=', '<', '<=', '>', '>=', 'in', 'not_in'] as const;

export type AbacAttribute = (typeof ABAC_ATTRIBUTES)[number];
export type AbacOperator = (typeof ABAC_OPERATORS)[number];

export interface AbacConditionDto {
  attribute: AbacAttribute;
  operator: AbacOperator;
  value: string | number | (string | number)[];
}

export interface AbacRuleDto {
  permission: string;
  effect: 'allow' | 'deny';
  conditions: AbacConditionDto[];
}

export interface RoleDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions?: string[];
  abac_rules?: AbacRuleDto[];
  field_policies?: FieldPolicyEntry[];
  updated_at: string | null;
}

export interface SaveRolePayload {
  name?: string;
  description?: string | null;
  permissions?: string[];
}

export interface PasskeyItem {
  id: string;
  name: string;
  aaguid: string | null;
  created_at: string | null;
  last_used_at: string | null;
}

/** A WebAuthn ceremony started by the API: its single-use id and the options for the browser. */
export interface PasskeyCeremony<T> {
  ceremony_id: string;
  options: T;
}

/** Stable `code` member of a 403 problem. */
export type ForbiddenCode =
  | 'permission_denied'
  | 'mfa_required'
  | 'company_access_revoked'
  | 'mfa_cannot_be_disabled';
