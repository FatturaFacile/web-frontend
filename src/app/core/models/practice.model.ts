export interface PracticeActivityItem {
  id: string;
  client_id: string;
  client_name?: string;
  case_id?: string | null;
  case_title?: string | null;
  user_id?: string;
  user_name?: string;
  activity_date: string;
  description: string;
  hours: number;
  rate: string;
  amount: string;
  status: 'unbilled' | 'billed' | 'written_off';
  is_billable?: boolean;
}

/** One user/case row of the activity control: logged time and amounts, billed and unbilled. */
export interface PracticeActivityControlRow {
  user_id: string | null;
  user_name: string | null;
  legal_case_id: string;
  case_number: string | null;
  client_id: string | null;
  billed_minutes: number;
  billed_amount: string;
  unbilled_minutes: number;
  unbilled_amount: string;
}

export interface PracticeActivityControlResponse {
  from?: string;
  to?: string;
  rows?: PracticeActivityControlRow[];
  activities?: PracticeActivityItem[];
  total_hours?: number;
  total_amount?: string;
  unbilled_count?: number;
  stale_count?: number;
}

export interface PracticeFeeNoteRequest {
  client_id: string;
  activity_ids: string[];
  note_number?: string | null;
  date: string;
  cpa_rate: string;
  ritenuta_rate: string;
  vat_rate: string;
}

export interface PracticeClosingChecklistItem {
  key: string;
  label: string;
  done: boolean;
  completed_at?: string;
  completed_by?: string;
}

export interface PracticeClosingRequest {
  client_id: string;
  period_start: string;
  period_end: string;
  checklist: PracticeClosingChecklistItem[];
  notes?: string | null;
}

export interface PracticeChecklistRequest {
  items: { key: string; done: boolean }[];
  notes?: string | null;
}

export interface PracticeCloseRequest {
  allow_unbilled?: boolean;
  reason?: string | null;
}

export interface PracticeClosing {
  id: string;
  client_id: string;
  client_name?: string;
  period_start: string;
  period_end: string;
  status: 'open' | 'closed';
  checklist: PracticeClosingChecklistItem[];
  closed_at?: string | null;
  closed_by?: string | null;
  notes?: string | null;
  unbilled_activities_count?: number;
}

export interface PracticeClosingOverview {
  closings: PracticeClosing[];
  total_open: number;
  total_closed: number;
  pending_checklists: number;
}

export interface PracticeRetainerRequest {
  client_id: string;
  legal_case_id?: string | null;
  received_on: string;
  amount: string;
  reference?: string | null;
  notes?: string | null;
}

export interface PracticeRetainerApplyRequest {
  fee_note_id: string;
  amount: string;
}

export interface PracticeRetainer {
  id: string;
  client_id: string;
  client?: { id?: string; company_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
  legal_case_id?: string | null;
  legal_case?: { id: string; case_number: string; title: string } | null;
  received_on: string;
  amount: string;
  applied_amount: string;
  reference?: string | null;
  notes?: string | null;
  status: 'open' | 'exhausted' | 'void';
  created_at?: string;
}

export interface PracticeRetainerBalance {
  client_id: string;
  client_name: string;
  total_received: string;
  total_applied: string;
  current_balance: string;
}

export interface PracticeAppliedRetainer {
  id: string;
  retainer_id: string;
  fee_note_id: string;
  amount: string;
  applied_at: string;
}
