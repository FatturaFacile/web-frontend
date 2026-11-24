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
  invoicing: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'sales', 'sales_manager'],
  },
  subscriptions: { read: ANY_MEMBER, write: ['owner', 'admin', 'accountant', 'sales'] },
  projects: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'project_manager', 'technician', 'member'],
  },
  assets: { read: ANY_MEMBER, write: FINANCE },
  service: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'service_manager', 'technician', 'member'],
  },
  automotive: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'service_manager', 'technician', 'member'],
  },
  construction: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'project_manager', 'technician', 'member'],
  },
  professionals: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'project_manager', 'member'],
  },
  manufacturing: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'production', 'technician', 'member'],
  },
  treasury: { read: FINANCE_READERS, write: FINANCE },
  workflow_design: { read: ANY_MEMBER, write: MANAGERS },
  // Backups hold every record of the company, and a restore replaces them.
  system: { read: MANAGERS, write: MANAGERS },
  // Immutable audit trail: owners and administrators, or an auditor granted audit.* on the membership.
  audit_trail: {
    read: MANAGERS,
    write: MANAGERS,
    grants: {
      read: ['audit.view', 'audit.verify', 'audit.export', 'audit.worm.manage', 'audit.*'],
      write: ['audit.verify', 'audit.worm.manage', 'audit.*'],
    },
  },
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
  leave_management: {
    read: ANY_MEMBER,
    write: ANY_MEMBER,
    grants: {
      read: [
        'leave_management.read',
        'leave_management.write',
        'leave_management.approve',
        'leave_management.*',
      ],
      write: ['leave_management.write', 'leave_management.approve', 'leave_management.*'],
    },
  },
  payroll: {
    read: MANAGERS,
    write: MANAGERS,
    grants: {
      read: ['payroll.read', 'payroll.write', 'payroll.*'],
      write: ['payroll.write', 'payroll.*'],
    },
  },
  // Italian payroll closing (Mod 077): the pay data of every employee, so the same rule as payroll. The self-service
  // keys let any member list and open their own payslips.
  italian_payroll: {
    read: MANAGERS,
    write: MANAGERS,
    grants: {
      read: ['payroll.read', 'payroll.write', 'payroll.*'],
      write: ['payroll.write', 'payroll.*'],
    },
  },
  italian_payroll_self: { read: ANY_MEMBER, write: ANY_MEMBER },
  workflow: { read: ANY_MEMBER, write: ANY_MEMBER },
  academy: { read: ANY_MEMBER, write: ANY_MEMBER },
  fiscal_retail: { read: FINANCE_READERS, write: ['owner', 'admin', 'accountant', 'sales'] },
  // Health data with fiscal codes: the read-only accountant role stays out.
  health_expenses: { read: FINANCE, write: FINANCE },
  exports: { read: FINANCE_READERS, write: FINANCE },
  reporting: { read: FINANCE_READERS, write: FINANCE },
  analytics: { read: FINANCE_READERS, write: FINANCE },
  communication: { read: FINANCE_READERS, write: ['owner', 'admin', 'accountant', 'sales'] },
  document_trust: { read: FINANCE_READERS, write: FINANCE },
  digital_preservation: { read: FINANCE_READERS, write: FINANCE },
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
  supplier_portal: {
    read: [...FINANCE_READERS, 'purchasing', 'procurement_manager'],
    write: [...FINANCE, 'purchasing', 'procurement_manager'],
  },
  travel: { read: ANY_MEMBER, write: ANY_MEMBER },
  configurator: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'sales', 'sales_manager'],
  },
  facility: { read: ANY_MEMBER, write: ANY_MEMBER },
  governance: { read: ANY_MEMBER, write: ANY_MEMBER },
  sustainability: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'production',
      'technician',
      'procurement_manager',
      'member',
    ],
  },
  returns: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'sales',
      'sales_manager',
      'warehouse',
      'purchasing',
      'service_manager',
      'technician',
      'member',
    ],
  },
  'credit-management': {
    read: [...FINANCE_READERS, 'sales', 'sales_manager'],
    write: [...FINANCE, 'sales_manager'],
  },
  // Accounts receivable and credit management (Mod 013). The API gates the routes with `module.access:invoicing`
  // (every member reads) and refuses the writes of anyone who is not a credit manager (owner, admin, accountant,
  // sales_manager), so the UI shows the write actions to those roles only.
  receivables: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'sales_manager'],
  },
  // Accounts payable (Mod 015): finance reads and prepares the payment batches; the CFO approval and the execution of
  // the payment are reserved to owner and admin.
  payables: { read: FINANCE_READERS, write: FINANCE },
  payables_approval: { read: FINANCE_READERS, write: MANAGERS },
  // Sales commissions and agent management (Mod 041): commissions are part of someone's pay. Owners, administrators,
  // accountants and sales managers read and maintain the conditions; the approval, invoicing and payment of a statement,
  // the fiscal parameters and the compliance exports are the `settle` ability, reserved to finance.
  agent_commissions: {
    read: [...FINANCE_READERS, 'sales_manager'],
    write: [...FINANCE, 'sales_manager'],
    grants: {
      read: [
        'agent_commissions.read',
        'agent_commissions.write',
        'agent_commissions.settle',
        'agent_commissions.*',
      ],
      write: ['agent_commissions.write', 'agent_commissions.settle', 'agent_commissions.*'],
    },
  },
  agent_commissions_settle: {
    read: FINANCE,
    write: FINANCE,
    grants: {
      read: ['agent_commissions.settle', 'agent_commissions.*'],
      write: ['agent_commissions.settle', 'agent_commissions.*'],
    },
  },
  shift_planning: {
    read: ['owner', 'admin', 'hr', 'production'],
    write: ['owner', 'admin', 'hr', 'production'],
    grants: { read: ['shift_planning.*'], write: ['shift_planning.*'] },
  },
  shift_planning_self: { read: ANY_MEMBER, write: ANY_MEMBER },
  // Resource planning and capacity saturation (Mod 079): planners write; members and accountants read the plan.
  resource_planning: {
    read: ['owner', 'admin', 'hr', 'project_manager', 'production', 'member', 'accountant'],
    write: ['owner', 'admin', 'hr', 'project_manager', 'production'],
  },
  artisanal_gelato: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'production', 'technician', 'member'],
  },
  talent_planning: {
    read: ['owner', 'admin', 'hr', 'payroll'],
    write: ['owner', 'admin', 'hr', 'payroll'],
  },
  talent_learning: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'hr'],
  },
  fleet: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'production',
      'technician',
      'procurement_manager',
      'member',
    ],
  },
  planning: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'production',
      'procurement_manager',
      'sales_manager',
      'member',
    ],
  },
  controlling: {
    read: [...FINANCE_READERS, 'sales_manager', 'production', 'procurement_manager'],
    write: [...FINANCE, 'production'],
  },
  analytical_accounting: {
    read: [...FINANCE_READERS, 'sales_manager', 'production', 'procurement_manager'],
    write: [...FINANCE],
  },
  budgeting: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'production',
      'procurement_manager',
      'sales_manager',
      'member',
    ],
  },
  business_intelligence: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'sales_manager',
      'procurement_manager',
      'service_manager',
      'project_manager',
      'member',
    ],
  },
  marketplace: { read: ['owner', 'admin'], write: ['owner', 'admin'] },
  // Recycle bin (restore or destroy deleted records); the notification centre is personal and has no module rule.
  platform: { read: ['owner', 'admin'], write: ['owner', 'admin'] },
  events: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'sales', 'sales_manager', 'service_manager', 'member'],
  },
  plm: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'production', 'technician', 'procurement_manager', 'member'],
  },
  rebates: {
    read: [...FINANCE_READERS, 'sales', 'sales_manager', 'procurement_manager'],
    write: [...FINANCE, 'sales_manager', 'procurement_manager'],
  },
  wms: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'production',
      'warehouse',
      'technician',
      'procurement_manager',
      'purchasing',
      'member',
    ],
  },
  transportation: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'warehouse',
      'sales',
      'sales_manager',
      'purchasing',
      'procurement_manager',
      'production',
      'member',
    ],
  },
  leases: { read: FINANCE_READERS, write: FINANCE },
  italian_vat: { read: FINANCE_READERS, write: FINANCE },
  intrastat: {
    read: [...FINANCE_READERS, 'customs'],
    write: [...FINANCE, 'customs'],
  },
  swiss_vat: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: { read: ['swiss_vat.*'], write: ['swiss_vat.*'] },
  },
};

/** Members with these roles can never write, on any route. */
export const READ_ONLY_ROLES: readonly string[] = ['accountant_readonly'];

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
  const granted = new Set(permissions.map(normalize));
  // A deny permission closes the module (or its write access) to the member whatever the role says; the owner is never locked out.
  if (
    !memberRoles.includes('owner') &&
    (granted.has(`deny:${module}`) || granted.has(`deny:${module}.${mode}`))
  ) {
    return false;
  }
  if (mode === 'write' && memberRoles.some((role) => READ_ONLY_ROLES.includes(role))) {
    return false;
  }

  const allowed = access[mode];
  if (allowed.includes('*') || memberRoles.some((role) => allowed.includes(role))) {
    return true;
  }

  if (granted.has('*') || granted.has(`${module}.${mode}`)) {
    return true;
  }
  return (access.grants?.[mode] ?? []).some((name) => granted.has(normalize(name)));
}
