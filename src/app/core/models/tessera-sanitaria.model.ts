import { QueryFilterParams } from './api.models';

export type TesseraSanitariaExpenseType =
  | 'TK'
  | 'FC'
  | 'FV'
  | 'SV'
  | 'SP'
  | 'AD'
  | 'AS'
  | 'SR'
  | 'CT'
  | 'PI'
  | 'IC'
  | 'AA';

export type TesseraSanitariaSubjectType = 'professional' | 'structure';

export interface TesseraSanitariaSettings {
  is_enabled: boolean;
  subject_type: TesseraSanitariaSubjectType;
  owner_fiscal_code?: string | null;
  region_code?: string | null;
  asl_code?: string | null;
  ssa_code?: string | null;
  pincode_configured?: boolean;
}

export interface TesseraSanitariaSettingsRequest {
  is_enabled: boolean;
  subject_type?: TesseraSanitariaSubjectType;
  owner_fiscal_code?: string | null;
  region_code?: string | null;
  asl_code?: string | null;
  ssa_code?: string | null;
}

export interface TesseraSanitariaExpense {
  id: string;
  document_type: 'invoice' | 'commercial_document';
  document_id: string;
  document_number?: string | null;
  expense_type: TesseraSanitariaExpenseType;
  expense_flag?: string | null;
  payment_date: string;
  amount: number;
  tax_rate?: number | null;
  vat_nature?: string | null;
  patient_fiscal_code?: string | null;
  patient_opposition: boolean;
  payment_traceable: boolean;
  transmission_status?: 'pending' | 'transmitted' | 'rejected' | 'opposed';
  created_at?: string;
}

export interface TesseraSanitariaExpenseRequest {
  document_type: 'invoice' | 'commercial_document';
  document_id: string;
  expense_type: TesseraSanitariaExpenseType;
  expense_flag?: string | null;
  payment_date: string;
  amount?: number | null;
  tax_rate?: number | null;
  vat_nature?: string | null;
  patient_fiscal_code?: string | null;
  patient_opposition: boolean;
  payment_traceable: boolean;
}

export interface TesseraSanitariaSummary {
  year: number;
  total_expenses: number;
  total_amount: number;
  total_traceable_amount: number;
  total_opposed: number;
  total_transmitted: number;
  total_pending: number;
}

/** Filters of the flagged expenses list (the grid adds sorting, column filters and paging). */
export interface TesseraSanitariaExpenseFilterParams extends QueryFilterParams {
  year?: number;
}
