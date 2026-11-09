export type LoyaltyCardStatus = 'active' | 'suspended' | 'expired' | 'blocked';
export type LoyaltyTransactionType = 'topup' | 'spend';

export interface LoyaltyCard {
  id: string;
  customer_id: string;
  customer_name?: string;
  card_number: string;
  balance: number;
  status: LoyaltyCardStatus | string;
  created_at: string;
  updated_at?: string;
}

export interface CreateLoyaltyCardPayload {
  customer_id: string;
  card_number?: string;
  initial_balance?: number;
}

export interface UpdateLoyaltyCardPayload {
  customer_id?: string;
  status?: LoyaltyCardStatus | string;
}

export interface LoyaltyTransaction {
  id: string;
  loyalty_card_id?: string;
  type: LoyaltyTransactionType;
  amount: number;
  description?: string;
  created_at: string;
}

export interface RecordLoyaltyTransactionPayload {
  type: LoyaltyTransactionType;
  amount: number;
  description?: string;
}
