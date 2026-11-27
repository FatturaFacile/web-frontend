/**
 * Module access map, mirrored from `config/permissions.php` of the Laravel API (web-api).
 * Keep it in sync with that file: the API is the authority, this map only decides what the UI shows.
 */

export type AccessMode = 'read' | 'write';

/** Role wildcard: every member of the tenant. */
const ANY_MEMBER = ['*'] as const;
const FINANCE = ['owner', 'admin', 'accountant'] as const;
const FINANCE_READERS = [...FINANCE, 'accountant_readonly', 'external_fiduciary'] as const;
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
  // Marketing Automation (Mod 155): sales runs the outreach, every member reads the dashboards.
  marketing_automation: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'sales', 'sales_manager'],
  },
  // Electronic signatures (FES / FEA / FEQ): every member follows and starts the signature of a document they can see;
  // the provider credentials and the compliance rules are the `configure` ability of owners and administrators.
  electronic_signature: {
    read: ANY_MEMBER,
    write: [
      'owner',
      'admin',
      'accountant',
      'sales',
      'sales_manager',
      'purchasing',
      'procurement_manager',
      'hr',
      'member',
    ],
    grants: {
      read: ['electronic_signature.read', 'electronic_signature.write', 'electronic_signature.*'],
      write: ['electronic_signature.write', 'electronic_signature.*'],
    },
  },
  electronic_signature_configure: {
    read: MANAGERS,
    write: MANAGERS,
    grants: {
      read: ['electronic_signature.configure', 'electronic_signature.*'],
      write: ['electronic_signature.configure', 'electronic_signature.*'],
    },
  },
  // Intercompany mirror postings, reciprocal reconciliation and consolidated statements (Mod 021): finance roles.
  intercompany: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['intercompany.read', 'intercompany.write', 'intercompany.*', 'gl.*'],
      write: ['intercompany.write', 'intercompany.*', 'gl.*'],
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
  // Expense and travel management (Mod 075): every member files their own reports, the API decides who approves.
  // The corporate card reconciliation is the finance ability.
  expense_management: { read: ANY_MEMBER, write: ANY_MEMBER },
  // Tender management (Mod 169): bids, vault documents and offers are commercial and finance work.
  tender_management: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['tender_management.read', 'tender_management.*'],
      write: ['tender_management.write', 'tender_management.*'],
    },
  },
  expense_management_finance: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['expense_management.settle', 'expense_management.*'],
      write: ['expense_management.settle', 'expense_management.*'],
    },
  },
  // GDO trade terms (Mod 231): finance and sales roles read the contracts, rebates and margins; owners, administrators,
  // accountants and sales managers keep them. Running and reversing the accrual and settling is the `settle` ability, the
  // API reserves it to finance (a member can be granted gdo_trade_terms.settle).
  gdo_trade_terms: {
    read: [...FINANCE_READERS, 'sales', 'sales_manager'],
    write: [...FINANCE, 'sales_manager'],
    grants: {
      read: [
        'gdo_trade_terms.read',
        'gdo_trade_terms.write',
        'gdo_trade_terms.settle',
        'gdo_trade_terms.*',
      ],
      write: ['gdo_trade_terms.write', 'gdo_trade_terms.settle', 'gdo_trade_terms.*'],
    },
  },
  // Statutory financial statements (Mod 167): finance roles prepare, validate and file the dossier; auditors read it.
  statutory_financials: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['statutory_financials.read', 'statutory_financials.write', 'statutory_financials.*'],
      write: ['statutory_financials.write', 'statutory_financials.*'],
    },
  },
  gdo_trade_terms_finance: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['gdo_trade_terms.settle', 'gdo_trade_terms.*'],
      write: ['gdo_trade_terms.settle', 'gdo_trade_terms.*'],
    },
  },
  // Industrial laundries and linen / workwear rental (Mod 177): finance, sales and warehouse roles read; finance, sales
  // managers and the warehouse and production staff of the laundry write. Consolidating the monthly bill is the `bill`
  // ability, the API reserves it to finance (a member can be granted industrial_laundry.bill).
  industrial_laundry: {
    read: [...FINANCE_READERS, 'sales', 'sales_manager', 'warehouse', 'production'],
    write: [...FINANCE, 'sales_manager', 'warehouse', 'production'],
    grants: {
      read: [
        'industrial_laundry.read',
        'industrial_laundry.write',
        'industrial_laundry.bill',
        'industrial_laundry.*',
      ],
      write: ['industrial_laundry.write', 'industrial_laundry.bill', 'industrial_laundry.*'],
    },
  },
  industrial_laundry_finance: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['industrial_laundry.bill', 'industrial_laundry.*'],
      write: ['industrial_laundry.bill', 'industrial_laundry.*'],
    },
  },
  // Passenger transport (Mod 176): finance, dispatchers and operations managers read and write bookings, dispatch, fleet, driver
  // compliance, the tachograph archive, service sheets and contracts; sales roles read. Invoicing (single and month-end) is the
  // `bill` ability, the API reserves it to finance (a member can be granted passenger_transport.bill).
  passenger_transport: {
    read: [...FINANCE_READERS, 'dispatcher', 'operations_manager', 'sales', 'sales_manager'],
    write: [...FINANCE, 'dispatcher', 'operations_manager'],
    grants: {
      read: [
        'passenger_transport.read',
        'passenger_transport.write',
        'passenger_transport.bill',
        'passenger_transport.*',
      ],
      write: ['passenger_transport.write', 'passenger_transport.bill', 'passenger_transport.*'],
    },
  },
  // Customer satisfaction (Mod 245): finance, sales, service and quality roles read the surveys and the ISO 9001 analytics; owners,
  // administrators, accountants, sales, operations and support managers write (templates, recovery cases, reports).
  customer_satisfaction: {
    read: [
      ...FINANCE_READERS,
      'sales',
      'sales_manager',
      'operations_manager',
      'support_manager',
      'dispatcher',
      'technician',
    ],
    write: [...FINANCE, 'sales_manager', 'operations_manager', 'support_manager'],
    grants: {
      read: [
        'customer_satisfaction.read',
        'customer_satisfaction.write',
        'customer_satisfaction.*',
      ],
      write: ['customer_satisfaction.write', 'customer_satisfaction.*'],
    },
  },
  // Swiss eBill (Mod 025): finance reads and writes (settings, sending, recall); sales roles follow the delivery state of their invoices.
  swiss_ebill: {
    read: [...FINANCE_READERS, 'sales', 'sales_manager'],
    write: [...FINANCE, 'sales_manager'],
    grants: {
      read: ['swiss_ebill.read', 'swiss_ebill.write', 'swiss_ebill.*'],
      write: ['swiss_ebill.write', 'swiss_ebill.*'],
    },
  },
  passenger_transport_finance: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['passenger_transport.bill', 'passenger_transport.*'],
      write: ['passenger_transport.bill', 'passenger_transport.*'],
    },
  },
  // Franchise network governance (Mod 244): every member reads; the franchise director governs the network (agreements, formulas,
  // pushes, billing), the area manager runs the store audits, the franchisee owner and manager use the portal of their own store.
  franchise_network: {
    read: ANY_MEMBER,
    write: [...FINANCE, 'franchise_director', 'area_manager', 'franchisee_owner', 'franchisee_manager'],
    grants: {
      read: [
        'franchise_network.read',
        'franchise_network.write',
        'franchise_network.manage',
        'franchise_network.audit',
        'franchise_network.portal',
        'franchise_network.*',
      ],
      write: [
        'franchise_network.write',
        'franchise_network.manage',
        'franchise_network.audit',
        'franchise_network.portal',
        'franchise_network.*',
      ],
    },
  },
  franchise_network_manage: {
    read: ['owner', 'admin', 'franchise_director'],
    write: ['owner', 'admin', 'franchise_director'],
    grants: {
      read: ['franchise_network.manage', 'franchise_network.*'],
      write: ['franchise_network.manage', 'franchise_network.*'],
    },
  },
  franchise_network_audit: {
    read: ['owner', 'admin', 'franchise_director', 'area_manager'],
    write: ['owner', 'admin', 'franchise_director', 'area_manager'],
    grants: {
      read: ['franchise_network.audit', 'franchise_network.manage', 'franchise_network.*'],
      write: ['franchise_network.audit', 'franchise_network.manage', 'franchise_network.*'],
    },
  },
  franchise_network_portal: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'franchisee_owner', 'franchisee_manager'],
    grants: {
      read: ['franchise_network.portal', 'franchise_network.*'],
      write: ['franchise_network.portal', 'franchise_network.*'],
    },
  },
  // Corporate conventions (Mod 358): finance and sales roles read and write the conventions, the till and the welfare vouchers.
  // Invoicing the employer quota and settling welfare vouchers is the `bill` ability, the API reserves it to finance (a member can
  // be granted corporate_conventions.bill).
  corporate_conventions: {
    read: [...FINANCE_READERS, 'sales', 'sales_manager'],
    write: [...FINANCE, 'sales', 'sales_manager'],
    grants: {
      read: [
        'corporate_conventions.read',
        'corporate_conventions.write',
        'corporate_conventions.bill',
        'corporate_conventions.*',
      ],
      write: ['corporate_conventions.write', 'corporate_conventions.bill', 'corporate_conventions.*'],
    },
  },
  // Product catalog (Mod 052): every member reads; stock, purchasing, sales and finance roles maintain the catalog.
  product_catalog: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'warehouse', 'purchasing', 'sales', 'sales_manager', 'member'],
    grants: {
      read: ['product_catalog.read', 'product_catalog.write', 'product_catalog.*'],
      write: ['product_catalog.write', 'product_catalog.*'],
    },
  },
  corporate_conventions_finance: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: ['corporate_conventions.bill', 'corporate_conventions.*'],
      write: ['corporate_conventions.bill', 'corporate_conventions.*'],
    },
  },
  configurator: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'sales', 'sales_manager'],
  },
  cpq_configurator: {
    read: ANY_MEMBER,
    write: ['owner', 'admin', 'accountant', 'sales', 'sales_manager'],
  },
  cpq_configurator_admin: {
    read: ['owner', 'admin', 'sales_manager'],
    write: ['owner', 'admin', 'sales_manager'],
    grants: {
      read: ['cpq_configurator.manage', 'cpq_configurator.*'],
      write: ['cpq_configurator.manage', 'cpq_configurator.*'],
    },
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
  // Cash flow forecasting and liquidity planning (Mod 017): finance reads and plans, the crisis indicators are board matter.
  liquidity_planning: { read: FINANCE_READERS, write: FINANCE },
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
  // Dunning and debt collection (Mod 014): finance and sales managers read the proposals and the notices; sending, the
  // legal escalation (Betreibung dossier, messa in mora) and the settings are write abilities.
  debt_collection: {
    read: [...FINANCE_READERS, 'sales_manager'],
    write: FINANCE,
    grants: {
      read: [
        'debt_collection.read',
        'debt_collection.write',
        'debt_collection.escalate',
        'debt_collection.*',
      ],
      write: ['debt_collection.write', 'debt_collection.escalate', 'debt_collection.*'],
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
  // Spend rules, thresholds and actual volumes of the budget control: owners, administrators, accountants and members granted budgeting.control.manage.
  budgeting_control: {
    read: ANY_MEMBER,
    write: FINANCE,
    grants: {
      read: ['budgeting.control.manage', 'budgeting.*'],
      write: ['budgeting.control.manage', 'budgeting.*'],
    },
  },
  // Deciding an override (deroga) is the CFO's call: owners, administrators and members granted budgeting.override.approve.
  budgeting_override: {
    read: ANY_MEMBER,
    write: ['owner', 'admin'],
    grants: {
      read: ['budgeting.override.approve', 'budgeting.*'],
      write: ['budgeting.override.approve', 'budgeting.*'],
    },
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
  data_migration: {
    read: FINANCE_READERS,
    write: FINANCE,
    grants: {
      read: [
        'data_migration.read',
        'data_migration.view',
        'data_migration.write',
        'data_migration.manage',
        'data_migration.execute',
        'data_migration.rollback',
        'data_migration.*',
      ],
      write: [
        'data_migration.write',
        'data_migration.manage',
        'data_migration.execute',
        'data_migration.rollback',
        'data_migration.*',
      ],
    },
  },
  fiduciary_portal: {
    read: [...FINANCE_READERS, 'finance_director'],
    write: [...FINANCE, 'external_fiduciary', 'finance_director'],
    grants: {
      read: ['fiduciary_portal.*', 'gl.*'],
      write: ['fiduciary_portal.*', 'gl.*'],
    },
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
