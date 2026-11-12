/** Statuses the API accepts on a card (`in:active,blocked`). */
export type LoyaltyCardStatus = 'active' | 'blocked';
/** Kinds of card (`in:loyalty,voucher,prepaid`). */
export type LoyaltyCardType = 'loyalty' | 'voucher' | 'prepaid';
/** Transaction types the API accepts (`in:earn,redeem,topup,adjust`). */
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'topup' | 'adjust';

export interface LoyaltyCard {
  id: string;
  contact_id: string | null;
  card_number: string;
  type: LoyaltyCardType;
  balance: number | string;
  currency?: string | null;
  status: LoyaltyCardStatus | string;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateLoyaltyCardPayload {
  contact_id?: string | null;
  type: LoyaltyCardType;
  card_number?: string;
  currency?: string;
  expires_at?: string | null;
  initial_balance?: number;
}

export interface UpdateLoyaltyCardPayload {
  contact_id?: string | null;
  type?: LoyaltyCardType;
  status?: LoyaltyCardStatus;
}

export interface LoyaltyTransaction {
  id: string;
  loyalty_card_id?: string;
  type: LoyaltyTransactionType;
  amount: number | string;
  description?: string | null;
  created_at: string;
}

export interface RecordLoyaltyTransactionPayload {
  type: LoyaltyTransactionType;
  amount: number;
  description?: string;
  invoice_id?: string | null;
}
