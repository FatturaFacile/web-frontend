export type ExpenseStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'reimbursed'
  | 'paid';

export interface ExpenseResource {
  id: string;
  expense_number?: string;
  date: string;
  category_id?: string | null;
  category_name?: string;
  amount: number;
  vat_amount?: number;
  currency: string;
  description: string;
  merchant?: string;
  status: ExpenseStatus;
  user_id?: string;
  user_name?: string;
  project_id?: string | null;
  has_receipt?: boolean;
  attachments_count?: number;
  created_at?: string;
}

export interface CreateExpensePayload {
  date: string;
  amount: number;
  vat_amount?: number;
  currency: string;
  description: string;
  category_id?: string | null;
  merchant?: string | null;
  status?: ExpenseStatus;
  project_id?: string | null;
}

export interface UpdateExpensePayload extends Partial<CreateExpensePayload> {}

export interface ExpenseSummaryReport {
  total_amount: number;
  currency: string;
  by_category: { category: string; amount: number; percentage: number }[];
  by_month: { month: string; amount: number }[];
}
