/**
 * Module access map, mirrored from `config/permissions.php` of the Laravel API (web-api).
 * Keep it in sync with that file: the API is the authority, this map only decides what the UI shows.
 */

export type AccessMode = 'read' | 'write';

/** Role wildcard: every member of the tenant. */
const ANY_MEMBER = ['*'] as const;
const FINANCE = ['owner', 'admin', 'accountant'] as const;
const FINANCE_READERS = [...FINANCE, 'accountant_readonly'] as const;
const MANAGERS = ['owner', 'admin'] as const;
const CONTRACT_MANAGERS = [
  'owner',
  'admin',
  'accountant',
  'sales_manager',
  'procurement_manager',
  'service_manager',
] as const;

interface ModuleAccess {
  readonly read: readonly string[];
  readonly write: readonly string[];
  /** Further permission names that open the read or write access of the module. */
  readonly grants?: { readonly read: readonly string[]; readonly write: readonly string[] };
}

export const MODULE_ACCESS: Readonly<Record<string, ModuleAccess>> = {
  crm: { read: ANY_MEMBER, write: ['owner', 'admin', 'accountant', 'sales', 'sales_manager'] },
  invoicing: { read: ANY_MEMBER, write: ['owner', 'admin', 'accountant', 'sales'] },
  subscriptions: { read: ANY_MEMBER, write: ['owner', 'admin', 'accountant', 'sales'] },
  projects: { read: ANY_MEMBER, write: ['owner', 'admin', 'project_manager', 'technician', 'member'] },
  assets: { read: ANY_MEMBER, write: FINANCE },
  service: { read: ANY_MEMBER, write: ['owner', 'admin', 'service_manager', 'technician', 'member'] },
  automotive: { read: ANY_MEMBER, write: ['owner', 'admin', 'service_manager', 'technician', 'member'] },
  construction: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'project_manager', 'technician', 'member'],
  },
  professionals: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'project_manager', 'member'],
  },
  manufacturing: { read: ANY_MEMBER, write: ['owner', 'admin', 'production', 'technician', 'member'] },
  treasury: { read: FINANCE_READERS, write: FINANCE },
  // Backups hold every record of the company, and a restore replaces them.
  system: { read: MANAGERS, write: MANAGERS },
  ledger: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: { read: ['gl.*', 'gl.journals.post'], write: ['gl.*'] },
  },
  procurement: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'purchasing', 'procurement_manager', 'member'],
  },
  inventory: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'warehouse', 'purchasing', 'technician', 'member'],
  },
  customs: {
    read: ['owner', 'admin', 'accountant', 'customs', 'warehouse', 'sales'],
    write: ['owner', 'admin', 'accountant', 'customs'],
  },
  documents: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'sales', 'purchasing', 'hr', 'member'],
  },
  contracts: { read: CONTRACT_MANAGERS, write: CONTRACT_MANAGERS },
  assistant: { read: ANY_MEMBER, write: ANY_MEMBER },
  edocument_networks: { read: FINANCE, write: FINANCE },
  workspace: { read: ANY_MEMBER, write: ANY_MEMBER },
  hr: { read: ['owner', 'admin', 'hr', 'payroll'], write: ['owner', 'admin', 'hr', 'payroll'] },
  fiscal_retail: { read: FINANCE_READERS, write: ['owner', 'admin', 'accountant', 'sales'] },
  // Health data with fiscal codes: the read-only accountant role stays out.
  health_expenses: { read: FINANCE, write: FINANCE },
  exports: { read: FINANCE_READERS, write: FINANCE },
  reporting: { read: FINANCE_READERS, write: FINANCE },
  analytics: { read: FINANCE_READERS, write: FINANCE },
  communication: { read: FINANCE_READERS, write: ['owner', 'admin', 'accountant', 'sales'] },
  document_trust: { read: FINANCE_READERS, write: FINANCE },
  integrations: { read: MANAGERS, write: MANAGERS },
  payment_links: { read: FINANCE_READERS, write: ['owner', 'admin', 'accountant', 'sales'] },
  associations: {
    read: ['owner', 'admin', 'secretary', 'accountant'],
    write: ['owner', 'admin', 'secretary', 'accountant'],
  },
  workshop: {
    read: [...FINANCE_READERS, 'sales', 'technician', 'service_manager'],
    write: [...FINANCE, 'sales', 'technician', 'service_manager'],
  },
  construction_trades: {
    read: [...FINANCE_READERS, 'sales', 'project_manager', 'technician'],
    write: [...FINANCE, 'sales', 'project_manager', 'technician'],
  },
  childcare: {
    read: ['owner', 'admin', 'childcare_manager', 'educator', 'accountant'],
    write: ['owner', 'admin', 'childcare_manager', 'educator', 'accountant'],
  },
  practice: { read: FINANCE_READERS, write: FINANCE },
  hospitality: {
    read: [...FINANCE_READERS, 'sales', 'member'],
    write: ['owner', 'admin', 'sales', 'member'],
  },
  visitors: { read: ANY_MEMBER, write: ANY_MEMBER },
  intrastat: {
    read: [...FINANCE_READERS, 'customs'],
    write: [...FINANCE, 'customs'],
  },
};

/** Members with these roles can never write, on any route. */
export const READ_ONLY_ROLES: readonly string[] = ['accountant_readonly'];

/** Detail of the 403 problem raised when the role of the member has no access to the module. */
export const FORBIDDEN_MODULE_ACCESS_TITLE = 'Forbidden Module Access';

const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Whether a member with these roles (in the active tenant) and extra permissions may read or write a module.
 * Unknown modules are denied, so a typo hides the entry instead of showing it.
 */
export function canAccessModule(
  module: string,
  mode: AccessMode,
  roles: readonly string[],
  permissions: readonly string[] = [],
): boolean {
  const access = MODULE_ACCESS[module];
  if (!access) {
    return false;
  }
  const memberRoles = roles.map(normalize);
  if (mode === 'write' && memberRoles.some((role) => READ_ONLY_ROLES.includes(role))) {
    return false;
  }

  const allowed = access[mode];
  if (allowed.includes('*') || memberRoles.some((role) => allowed.includes(role))) {
    return true;
  }

  const granted = new Set(permissions.map(normalize));
  if (granted.has('*') || granted.has(`${module}.${mode}`)) {
    return true;
  }
  return (access.grants?.[mode] ?? []).some((name) => granted.has(normalize(name)));
}
