export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string | null;
  balance: number;
  currency?: string;
}

export interface LedgerEntryLine {
  id?: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface LedgerEntry {
  id: string;
  entry_number: string;
  date: string;
  description: string;
  lines: LedgerEntryLine[];
  total_debit?: number;
  total_credit?: number;
  created_at?: string;
}

export interface CreateLedgerEntryPayload {
  entry_number: string;
  date: string;
  description: string;
  lines: {
    account_id: string;
    debit: number;
    credit: number;
    description?: string | null;
  }[];
}

export interface VatSettlement {
  id: string;
  period: string;
  year: number;
  jurisdiction: 'IT' | 'CH';
  total_vat_collected: number;
  total_vat_paid: number;
  balance: number;
  status: 'draft' | 'settled' | 'paid';
  settled_at?: string | null;
}
