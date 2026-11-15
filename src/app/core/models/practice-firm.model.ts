/** Practice management tools: matter expenses, client funds ledger, conflicts check and fee proposals. Mirrors the PracticeRequest of the API. */

export type PracticeClientRef = { id?: string; company_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
export type PracticeCaseRef = { id: string; case_number: string; title: string } | null;

export type PracticeExpenseCategory = 'court_fee' | 'travel' | 'filing' | 'expert' | 'courier' | 'other';
export const PRACTICE_EXPENSE_CATEGORIES: readonly PracticeExpenseCategory[] = ['court_fee', 'travel', 'filing', 'expert', 'courier', 'other'];

export interface PracticeExpense {
  id: string;
  legal_case_id: string;
  legal_case?: PracticeCaseRef;
  expense_date: string;
  category: PracticeExpenseCategory;
  description: string;
  amount: string;
  is_billable: boolean;
  is_billed: boolean;
}

export interface PracticeExpenseRequest {
  legal_case_id?: string;
  expense_date: string;
  category: PracticeExpenseCategory;
  description: string;
  amount: string;
  is_billable?: boolean;
}

export type PracticeTrustType = 'deposit' | 'withdrawal' | 'fee_transfer' | 'reversal';
export const PRACTICE_TRUST_INPUT_TYPES: readonly Exclude<PracticeTrustType, 'reversal'>[] = ['deposit', 'withdrawal', 'fee_transfer'];

export interface PracticeTrustTransaction {
  id: string;
  client_id: string;
  client?: PracticeClientRef;
  legal_case_id: string | null;
  legal_case?: PracticeCaseRef;
  type: PracticeTrustType;
  occurred_on: string;
  amount: string;
  signed_amount: string;
  balance_after: string;
  reference: string | null;
  description: string | null;
  reverses_id: string | null;
}

export interface PracticeTrustTransactionRequest {
  type: Exclude<PracticeTrustType, 'reversal'>;
  client_id: string;
  legal_case_id?: string | null;
  occurred_on: string;
  amount: string;
  reference?: string | null;
  description?: string | null;
}

export interface PracticeTrustBalance {
  client_id: string;
  client_name: string;
  total: string;
  matters: { legal_case_id: string | null; balance: string }[];
}

export type PracticeConflictRole = 'client' | 'opposing_party' | 'related_party';
export type PracticePartyRole = PracticeConflictRole | 'witness';
export type PracticeConflictResult = 'clear' | 'review' | 'conflict';

export interface PracticeConflictMatch {
  source: 'party' | 'client';
  name: string;
  role: PracticePartyRole;
  contact_id: string | null;
  legal_case_id: string | null;
  case_number: string | null;
  case_title: string | null;
}

export interface PracticeConflictCheck {
  id: string;
  subject_name: string;
  subject_role: PracticeConflictRole;
  contact_id: string | null;
  result: PracticeConflictResult;
  matches: PracticeConflictMatch[];
  created_at?: string;
}

export interface PracticeConflictCheckRequest {
  name: string;
  role: PracticeConflictRole;
  contact_id?: string | null;
}

export interface PracticeCaseParty {
  id: string;
  legal_case_id: string;
  legal_case?: PracticeCaseRef;
  contact_id: string | null;
  name: string;
  role: PracticePartyRole;
  notes: string | null;
}

export interface PracticeCasePartyRequest {
  legal_case_id: string;
  contact_id?: string | null;
  name: string;
  role: PracticePartyRole;
  notes?: string | null;
}

export type PracticeFeeProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined';
export type PracticeFeeType = 'hourly' | 'fixed';

export interface PracticeFeeProposal {
  id: string;
  number: string;
  client_id: string;
  client?: PracticeClientRef;
  title: string;
  scope: string | null;
  fee_type: PracticeFeeType;
  hourly_rate: string | null;
  estimated_hours: string | null;
  fixed_fee: string | null;
  estimated_total: string;
  valid_until: string | null;
  status: PracticeFeeProposalStatus;
  legal_case_id: string | null;
  legal_case?: PracticeCaseRef;
  decision_notes: string | null;
}

export interface PracticeFeeProposalRequest {
  client_id?: string;
  title: string;
  scope?: string | null;
  fee_type: PracticeFeeType;
  hourly_rate?: string | null;
  estimated_hours?: string | null;
  fixed_fee?: string | null;
  valid_until?: string | null;
}

export interface PracticeFeeProposalAcceptRequest {
  conflict_check_id: string;
  override_reason?: string | null;
}
