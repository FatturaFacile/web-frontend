export interface LegalCase {
  id?: string;
  num: string;
  client: string;
  subject: string;
  hours: string;
  fee: string;
  amlCompliant?: boolean;
  status?: string;
}

export interface TimeLog {
  id: string;
  legal_case_id: string;
  date: string;
  duration_minutes: number;
  hourly_rate: number;
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
  legal_case_id: string;
  client_id: string;
  fee_note_number: string;
  date: string;
  net_amount: number;
  social_contribution_rate?: number;
  withholding_tax_rate?: number;
  vat_rate?: number;
  gross_amount?: number;
}
