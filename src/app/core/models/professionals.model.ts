/** Name fields of a client as the professionals endpoints embed them. */
export interface ProfessionalsClientName {
  id?: string;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface LegalCase {
  id: string;
  case_number: string;
  client_id: string;
  client?: ProfessionalsClientName | null;
  title: string;
  status?: string;
  aml_kyc_completed?: boolean;
  /** Minutes logged on the case (sum of its billable activities). */
  logged_minutes?: number | string | null;
  /** Fees logged on the case (sum of its billable activities). */
  fee_total?: number | string | null;
}

export interface TimeLog {
  id: string;
  legal_case_id: string;
  legal_case?: { id: string; case_number: string; title: string; client?: ProfessionalsClientName | null } | null;
  date: string;
  duration_minutes: number;
  hourly_rate: number | string;
  fee_amount?: number | string;
  is_billed?: boolean;
  description: string;
}

export interface CreateTimeLogPayload {
  legal_case_id: string;
  date: string;
  duration_minutes: number;
  hourly_rate: number;
  description: string;
}

export interface FeeNote {
  id: string;
  legal_case_id: string | null;
  client_id: string;
  client?: ProfessionalsClientName | null;
  note_number: string;
  date: string;
  status?: string;
  taxable_fees: number | string;
  cassa_previdenza_amount: number | string;
  ritenuta_acconto_amount: number | string;
  vat_amount: number | string;
  net_payable: number | string;
}
