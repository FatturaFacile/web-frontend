/** Address types, contact person roles and hierarchy types accepted by the CRM contact API. */
export const ADDRESS_TYPES = ['legal', 'billing', 'shipping', 'site'] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const PERSON_ROLES = [
  'administration',
  'purchasing',
  'logistics',
  'technical',
  'management',
  'sales',
  'other',
] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const HIERARCHY_TYPES = ['holding', 'subsidiary', 'branch'] as const;
export type HierarchyType = (typeof HIERARCHY_TYPES)[number];

export const INTERACTION_TYPES = ['call', 'email', 'note', 'meeting'] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const CONSENT_CHANNELS = ['email', 'sms', 'phone', 'post'] as const;
export const CONSENT_PURPOSES = ['marketing', 'newsletter', 'profiling'] as const;
export const CONSENT_SOURCES = ['web_form', 'phone', 'in_person', 'api'] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
export type ContactConsentSource = (typeof CONSENT_SOURCES)[number];

export interface ContactAddressRecord {
  id: string;
  type: AddressType;
  label: string | null;
  recipient_name: string | null;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
  state_canton: string | null;
  country: string;
  is_default: boolean;
  notes: string | null;
}

export type ContactAddressPayload = Partial<Omit<ContactAddressRecord, 'id'>>;

export interface ContactPersonRecord {
  id: string;
  first_name: string | null;
  last_name: string;
  job_title: string | null;
  role: PersonRole | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
}

export type ContactPersonPayload = Partial<Omit<ContactPersonRecord, 'id'>>;

export interface HierarchyNode {
  id: string;
  name: string;
  hierarchy_type: HierarchyType | null;
  country: string | null;
  vat_number: string | null;
  uid_number: string | null;
  children?: HierarchyNode[];
}

export interface ContactHierarchy {
  ancestors: HierarchyNode[];
  tree: HierarchyNode;
}

export interface ConsentRecord {
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  status: 'granted' | 'withdrawn';
  captured_at: string | null;
  source: string;
  evidence?: string | null;
}

/** `GET /crm/consents`: the effective state per channel and purpose, and the full ledger. */
export interface ConsentLedger {
  effective: ConsentRecord[];
  history: ConsentRecord[];
}

export interface ConsentPayload {
  contact_id: string;
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  status: 'granted' | 'withdrawn';
  source: ContactConsentSource;
  evidence?: string | null;
}

export interface InteractionRecord {
  id: string;
  type: InteractionType;
  subject: string;
  notes?: string | null;
  outcome?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
}

export interface InteractionPayload {
  type: InteractionType;
  subject: string;
  notes?: string | null;
  outcome?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  occurred_at?: string | null;
}

export interface InteractionPage {
  data: InteractionRecord[];
  meta: { current_page: number; last_page: number; total: number };
}

/** One open invoice of the account statement in the customer overview. */
export interface OpenItem {
  invoice_id: string;
  invoice_number: string;
  date: string;
  due_date: string | null;
  currency: string;
  total: number;
  paid: number;
  balance: number;
  days_overdue?: number;
}
