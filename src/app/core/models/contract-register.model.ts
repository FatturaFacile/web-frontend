export type ContractKind = 'customer' | 'supplier';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'renewed';

export type ContractObligationType = 'obligation' | 'milestone';

export type ContractObligationStatus = 'pending' | 'completed' | 'waived' | 'overdue';

export type ContractAlertType = 'notice_deadline' | 'expiry';

export interface ContractPartyResource {
  id: string;
  role: string;
  name: string;
  contact_email?: string | null;
  vat_number?: string | null;
}

export interface ContractObligationResource {
  id: string;
  contract_kind: ContractKind;
  contract_id: string;
  type: ContractObligationType;
  title: string;
  description?: string | null;
  due_date: string;
  status: ContractObligationStatus;
  responsible_party?: string | null;
  penalty_amount?: string | null;
  completed_at?: string | null;
  created_at?: string;
}

export interface ContractStatusChangeResource {
  id: string;
  from_status: string;
  to_status: string;
  reason?: string | null;
  changed_by?: string | null;
  created_at: string;
}

export interface ContractResource {
  id: string;
  kind: ContractKind;
  contract_number: string;
  title: string;
  counterparty_id: string;
  counterparty_name?: string | null;
  start_date: string;
  end_date?: string | null;
  notice_period_days?: number | null;
  auto_renew?: boolean;
  renewal_term_months?: number | null;
  status: ContractStatus;
  currency?: string;
  total_value?: string | null;
  parties?: ContractPartyResource[];
  obligations?: ContractObligationResource[];
  created_at?: string;
  updated_at?: string;
}

export interface ContractAlertResource {
  id: string;
  contract_kind: ContractKind;
  contract_id: string;
  contract_number?: string;
  contract_title?: string;
  alert_type: ContractAlertType;
  due_on: string;
  is_acknowledged: boolean;
  message?: string | null;
  created_at?: string;
}

export interface StoreContractRequest {
  kind: ContractKind;
  counterparty_id: string;
  contract_number: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  notice_period_days?: number | null;
  auto_renew?: boolean;
  renewal_term_months?: number | null;
  currency?: string;
  total_value?: string | null;
}

export interface UpdateContractTermsRequest {
  notice_period_days?: number | null;
  auto_renew?: boolean;
  renewal_term_months?: number | null;
  total_value?: string | null;
}

export interface RenewContractRequest {
  new_end_date: string;
  renewal_term_months?: number | null;
  revised_value?: string | null;
}

export interface ContractTransitionRequest {
  status: ContractStatus;
  reason?: string | null;
}

export interface ContractSaveObligationRequest {
  type: ContractObligationType;
  title: string;
  description?: string | null;
  due_date: string;
  responsible_party?: string | null;
  penalty_amount?: string | null;
}

export interface ContractSavePartyRequest {
  role: string;
  name: string;
  contact_email?: string | null;
  vat_number?: string | null;
}

export interface ContractRegisterParams {
  kind?: ContractKind;
  status?: ContractStatus;
  search?: string;
  counterparty_id?: string;
  page?: number;
  per_page?: number;
}

export interface ContractObligationParams {
  contract_kind?: ContractKind;
  status?: ContractObligationStatus;
  due_before?: string;
  page?: number;
  per_page?: number;
}
