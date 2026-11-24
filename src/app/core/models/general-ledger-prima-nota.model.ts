/** General ledger Prima Nota engine: parallel ledger books, accounting templates (causali) and the year-end closing workflow. */

/** Ledger book code: 01 statutory (civilistico), 02 tax (fiscale), 03 IFRS. */
export type LedgerBookCode = '01' | '02' | '03';

export const LEDGER_BOOK_CODES: readonly LedgerBookCode[] = ['01', '02', '03'];

export type LedgerBookType = 'statutory' | 'tax' | 'ifrs';

export const LEDGER_TYPE_BY_BOOK: Readonly<Record<LedgerBookCode, LedgerBookType>> = {
  '01': 'statutory',
  '02': 'tax',
  '03': 'ifrs',
};

export function ledgerBookOfType(type: string): LedgerBookCode {
  return (LEDGER_BOOK_CODES.find((code) => LEDGER_TYPE_BY_BOOK[code] === type) ??
    '01') as LedgerBookCode;
}

// --- Accounting templates (causali contabili) ---

export type AccountingTemplateParameterType = 'account' | 'amount' | 'rate';

export interface AccountingTemplateParameter {
  key: string;
  type: AccountingTemplateParameterType;
}

export interface AccountingTemplateLine {
  account: string;
  side: 'debit' | 'credit';
  amount: string;
  description?: string | null;
}

export interface AccountingTemplate {
  id: string;
  code: string;
  category: string | null;
  journal_type: string | null;
  ledger_type: string | null;
  /** Name in the language of the request. */
  name: string;
  names: Record<'it' | 'de' | 'fr' | 'en', string>;
  description: string | null;
  descriptions?: Record<string, string> | null;
  parameters: AccountingTemplateParameter[];
  lines: AccountingTemplateLine[];
  is_system: boolean;
  is_active: boolean;
}

export interface AccountingTemplatePreviewPayload {
  amount: number | string;
  tax_rate?: number | string | null;
  /** Parameter key -> account code or id. */
  accounts?: Record<string, string>;
  cost_center_id?: string | null;
}

export interface AccountingTemplatePostPayload extends AccountingTemplatePreviewPayload {
  posting_date: string;
  fiscal_period_id?: string | null;
  description?: string | null;
  status?: 'draft' | 'posted';
  post_to_ledgers?: LedgerBookCode[];
}

export interface AccountingTemplatePreviewLine {
  line_number: number;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit_amount: string;
  credit_amount: string;
  description: string | null;
  cost_center_id: string | null;
  template_line: number;
}

export interface AccountingTemplatePreview {
  lines: AccountingTemplatePreviewLine[];
  total_debit: string;
  total_credit: string;
  difference: string;
  is_balanced: boolean;
}

// --- Prima Nota journal entry ---

export interface PrimaNotaLinePayload {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description?: string | null;
  cost_center_id?: string | null;
  competence_start_date?: string | null;
  competence_end_date?: string | null;
}

export interface PrimaNotaJournalPayload {
  posting_date: string;
  description: string;
  ledger_type: LedgerBookType;
  post_to_ledgers?: LedgerBookCode[];
  status: 'draft' | 'posted';
  lines: PrimaNotaLinePayload[];
}

export interface ReverseJournalPayload {
  reversal_date: string;
  reason?: string | null;
}

// --- Year-end closing workflow ---

export type ClosingStageKey = 'period_lock' | 'net_result' | 'closing' | 'opening';
export type ClosingStageStatus = 'completed' | 'ready' | 'blocked';

export interface ClosingStage {
  stage: 1 | 2 | 3 | 4;
  key: ClosingStageKey;
  status: ClosingStageStatus;
  summary: Record<string, unknown> | null;
  journal_entry_id: string | null;
  executed_by?: string | null;
  executed_at: string | null;
}

export interface ClosingWorkflow {
  fiscal_year_id: string;
  year_code: string;
  year_status: string;
  ledger: LedgerBookCode;
  ledger_type?: string;
  stages: ClosingStage[];
  next_stage: number | null;
  is_complete: boolean;
}

export interface ClosingStageRun {
  already_completed: boolean;
  stage: ClosingStage;
}
