export type ContractKind = 'customer' | 'supplier';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'renewed';

export type ContractObligationType = 'obligation' | 'milestone';

export type ContractObligationStatus = 'pending' | 'completed' | 'waived' | 'overdue';

export type ContractAlertType = 'notice_deadline' | 'expiry';

export type ContractPartyType = 'contact' | 'supplier' | 'user' | 'external';

export interface ContractPartyResource {
  id: string;
  party_type: ContractPartyType;
  party_id?: string | null;
  role: string;
  name: string | null;
  email?: string | null;
  notes?: string | null;
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
  owner_user_id?: string | null;
  amount?: string | null;
  currency?: string | null;
  remind_days_before?: number;
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
  currency?: string | null;
  contract_value?: string | null;
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
  contract_value?: string | null;
}

export interface UpdateContractTermsRequest {
  notice_period_days?: number | null;
  auto_renew?: boolean;
  renewal_term_months?: number | null;
  alert_days_before?: number;
}

/** Without a new end date the API extends the contract by its renewal term. */
export interface RenewContractRequest {
  new_end_date?: string | null;
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
  /** 'own' or 'counterparty'. */
  responsible_party?: string | null;
  owner_user_id?: string | null;
  /** The API requires amount and currency together. */
  amount?: string | null;
  currency?: string | null;
  remind_days_before?: number | null;
}

export interface ContractSavePartyRequest {
  party_type: ContractPartyType;
  /** Required for contact, supplier and user parties; prohibited for external ones. */
  party_id?: string;
  /** Required for external parties only. */
  name?: string;
  role: string;
  email?: string | null;
  notes?: string | null;
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
