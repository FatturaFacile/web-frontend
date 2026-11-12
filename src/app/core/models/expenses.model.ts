/** Statuses accepted by the API (`in:draft,submitted,approved,rejected`). */
export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface ExpenseResource {
  id: string;
  expense_number?: string;
  date: string;
  category_id?: string | null;
  category?: { id: string; code: string; name: string } | null;
  amount_net?: number;
  tax_rate?: number;
  tax_amount?: number;
  amount_gross: number;
  currency: string;
  notes?: string | null;
  merchant_name?: string | null;
  payment_method?: string | null;
  status: ExpenseStatus;
  user_id?: string;
  user?: { id: string; name: string; email: string } | null;
  project_id?: string | null;
  attachments_count?: number;
  created_at?: string;
}

/** Body of POST/PUT /expenses, with the API field names (StoreExpenseRequest). */
export interface CreateExpensePayload {
  category_id: string;
  date?: string | null;
  amount_gross?: number | null;
  amount_net?: number | null;
  tax_rate?: number | null;
  currency?: string | null;
  merchant_name?: string | null;
  payment_method?: string | null;
  status?: ExpenseStatus;
  notes?: string | null;
  project_id?: string | null;
}

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

export interface ExpenseSummaryReport {
  total_amount: number;
  currency: string;
  by_category: { category: string; amount: number; percentage: number }[];
  by_month: { month: string; amount: number }[];
}
