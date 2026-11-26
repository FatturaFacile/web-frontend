export type StudioExportFormatCode =
  | 'abacus_xml'
  | 'abacus_ascii'
  | 'topal'
  | 'sage50_extra'
  | 'swiss_fiduciary_universal'
  | 'teamsystem'
  | 'zucchetti'
  | 'profis'
  | 'datev_koinos'
  | 'universal_csv';

export interface FiduciaryClientSummary {
  readonly tenant_id: string;
  readonly name: string;
  readonly legal_name: string;
  readonly jurisdiction: 'IT' | 'CH';
  readonly country: string;
  readonly currency: string;
  readonly vat_number: string | null;
  readonly uid_number: string | null;
  readonly role: string;
  readonly periods_total: number;
  readonly periods_fiduciary_locked: number;
  readonly periods_closed: number;
  readonly periods_open: number;
  readonly latest_locked_period: string | null;
  readonly posted_entries_count: number;
  readonly verified_entries_count: number;
  readonly unverified_entries_count: number;
  readonly verification_progress_percent: number;
  readonly open_notes_count: number;
  readonly resolved_notes_count: number;
  readonly postable_accounts_count: number;
  readonly unmapped_accounts_count: number;
  readonly export_runs_count: number;
  readonly last_export_at: string | null;
}

export interface FiduciaryFiscalYear {
  readonly id: string;
  readonly year_code: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly status: string;
}

export interface FiduciaryFiscalPeriod {
  readonly id: string;
  readonly fiscal_year_id: string;
  readonly year_code?: string;
  readonly period_number: number;
  readonly period_name: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly status: string;
  readonly is_fiduciary_locked: boolean;
  readonly fiduciary_locked_at: string | null;
  readonly fiduciary_locked_by?: string | null;
  readonly fiduciary_lock_reason: string | null;
  readonly entries_count?: number;
  readonly verified_entries_count?: number;
}

export interface StudioExportFormatMeta {
  readonly code: StudioExportFormatCode;
  readonly jurisdiction: 'CH' | 'IT' | 'ALL';
  readonly extension: string;
  readonly mime_type: string;
  readonly label_key: string;
  readonly description_key: string;
}

export interface FiduciaryOverviewResponse {
  readonly active_tenant_id: string;
  readonly active_client: FiduciaryClientSummary | null;
  readonly clients: readonly FiduciaryClientSummary[];
  readonly fiscal_years: readonly FiduciaryFiscalYear[];
  readonly fiscal_periods: readonly FiduciaryFiscalPeriod[];
  readonly export_formats: readonly StudioExportFormatMeta[];
}

export interface FiduciaryJournalLine {
  readonly id: string;
  readonly line_number: number;
  readonly account_id: string;
  readonly account_code: string | null;
  readonly account_name: string | null;
  readonly studio_account_code: string | null;
  readonly studio_account_name: string | null;
  readonly description: string;
  readonly debit_amount: string;
  readonly credit_amount: string;
  readonly functional_debit: string;
  readonly functional_credit: string;
  readonly currency: string;
  readonly exchange_rate: string;
  readonly vat_code: string | null;
  readonly vat_rate_percent: string | null;
}

export interface FiduciaryJournalEntry {
  readonly id: string;
  readonly entry_number: string;
  readonly journal_number: number | null;
  readonly document_number: string | null;
  readonly fiscal_period_id: string;
  readonly period_name: string | null;
  readonly period_status: string | null;
  readonly is_period_fiduciary_locked: boolean;
  readonly posting_date: string | null;
  readonly document_date: string | null;
  readonly ledger_type: string;
  readonly journal_type: string;
  readonly description: string;
  readonly status: string;
  readonly total_amount: string;
  readonly fiduciary_verified: boolean;
  readonly fiduciary_verified_at: string | null;
  readonly fiduciary_verified_by: string | null;
  readonly fiduciary_verification_note: string | null;
  readonly open_notes_count: number;
  readonly lines: readonly FiduciaryJournalLine[];
}

export interface FiduciaryAccountLedgerLine {
  readonly line_id: string;
  readonly journal_entry_id: string;
  readonly entry_number: string;
  readonly posting_date: string;
  readonly description: string;
  readonly debit: string;
  readonly credit: string;
  readonly running_balance: string;
  readonly fiduciary_verified: boolean;
  readonly open_notes_count: number;
}

export interface FiduciaryAccountLedgerReport {
  readonly account: {
    readonly id: string;
    readonly account_code: string;
    readonly name: string;
    readonly studio_account_code: string | null;
    readonly studio_account_name: string | null;
  };
  readonly currency: string;
  readonly from: string;
  readonly to: string;
  readonly opening_balance: string;
  readonly closing_balance: string;
  readonly total_debit: string;
  readonly total_credit: string;
  readonly lines: readonly FiduciaryAccountLedgerLine[];
}

export interface FiduciaryTranscodingRow {
  readonly transcoding_id: string | null;
  readonly source_account_id: string;
  readonly source_account_code: string;
  readonly source_account_name: string;
  readonly source_standard: string;
  readonly account_type: string;
  readonly is_postable: boolean;
  readonly studio_system: string;
  readonly studio_account_code: string | null;
  readonly studio_account_name: string | null;
  readonly studio_vat_code: string | null;
  readonly studio_cost_center_code: string | null;
  readonly notes: string | null;
  readonly is_mapped: boolean;
}

export interface FiduciaryTranscodingMatrix {
  readonly studio_system: string;
  readonly total_accounts: number;
  readonly mapped_accounts: number;
  readonly unmapped_postable_accounts: number;
  readonly rows: readonly FiduciaryTranscodingRow[];
}

export interface FiduciaryEntryNote {
  readonly id: string;
  readonly journal_entry_id: string;
  readonly entry_number: string | null;
  readonly posting_date: string | null;
  readonly entry_description: string | null;
  readonly parent_note_id: string | null;
  readonly author_name: string;
  readonly author_role: string;
  readonly body: string;
  readonly status: 'open' | 'resolved';
  readonly resolved_at: string | null;
  readonly resolution_comment: string | null;
  readonly created_at: string | null;
  readonly replies: readonly FiduciaryEntryNote[];
}

export interface StudioExportValidationResult {
  readonly format_code: StudioExportFormatCode;
  readonly jurisdiction: string;
  readonly from_date: string;
  readonly to_date: string;
  readonly can_export: boolean;
  readonly entries_count: number;
  readonly lines_count: number;
  readonly total_debit: string;
  readonly total_credit: string;
  readonly is_balanced: boolean;
  readonly unmapped_accounts_count: number;
  readonly unmapped_accounts: readonly { account_id: string; account_code: string; account_name: string }[];
  readonly unmapped_vat_codes: readonly string[];
  readonly non_numeric_datev_accounts: readonly string[];
  readonly open_periods: readonly string[];
  readonly locked_periods: readonly string[];
  readonly warnings: readonly string[];
}

export interface FiduciaryExportRun {
  readonly id: string;
  readonly format_code: StudioExportFormatCode;
  readonly jurisdiction: string;
  readonly from_date: string;
  readonly to_date: string;
  readonly only_verified: boolean;
  readonly apply_transcoding: boolean;
  readonly entries_count: number;
  readonly lines_count: number;
  readonly unmapped_accounts_count: number;
  readonly total_debit: string;
  readonly total_credit: string;
  readonly currency: string;
  readonly file_name: string;
  readonly created_at: string | null;
}

export interface DossierPreviewSummary {
  readonly fiscal_year_id: string | null;
  readonly year_code: string | null;
  readonly from_date: string;
  readonly to_date: string;
  readonly datasets: Readonly<Record<string, number>>;
}

export interface FiduciaryAuditLogEntry {
  readonly id: string;
  readonly actor_name: string | null;
  readonly actor_role: string | null;
  readonly action: string;
  readonly target_type: string | null;
  readonly target_reference: string | null;
  readonly summary: string;
  readonly created_at: string | null;
}
