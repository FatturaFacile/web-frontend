import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CalculateTaxSettlementPayload,
  ChartOfAccount,
  CreateAccountPayload,
  GenerateIntrastatPayload,
  SubmitIntrastatPayload,
  CreateJournalEntryPayload,
  FiscalPeriodResource,
  IntrastatDeclarationResource,
  JournalEntryResource,
  PaginatedResponse,
  QueryFilterParams,
  TaxSettlementResource,
  TrialBalanceReport,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly glBase = `${environment.apiBaseUrl}/general-ledger`;
  private readonly intrastatBase = `${environment.apiBaseUrl}/intrastat`;

  // --- Chart of Accounts ---

  getAccounts(params?: QueryFilterParams): Observable<ApiResponse<ChartOfAccount[]>> {
    return this.http.get<ApiResponse<ChartOfAccount[]>>(`${this.glBase}/accounts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getAccountsTree(): Observable<ApiResponse<ChartOfAccount[]>> {
    return this.http.get<ApiResponse<ChartOfAccount[]>>(`${this.glBase}/accounts-tree`);
  }

  createAccount(payload: CreateAccountPayload): Observable<ApiResponse<ChartOfAccount>> {
    return this.http.post<ApiResponse<ChartOfAccount>>(`${this.glBase}/accounts`, payload);
  }

  // --- Journal Entries (/general-ledger/journals active successor) ---

  getJournals(params?: QueryFilterParams): Observable<PaginatedResponse<JournalEntryResource>> {
    return this.http.get<PaginatedResponse<JournalEntryResource>>(`${this.glBase}/journals`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getJournal(id: string): Observable<ApiResponse<JournalEntryResource>> {
    return this.http.get<ApiResponse<JournalEntryResource>>(`${this.glBase}/journals/${id}`);
  }

  createJournal(payload: CreateJournalEntryPayload): Observable<ApiResponse<JournalEntryResource>> {
    const normalizedPayload = {
      ...payload,
      posting_date: payload.posting_date || payload.date || new Date().toISOString().split('T')[0],
      lines: payload.lines.map((l) => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount ?? l.debit ?? 0,
        credit_amount: l.credit_amount ?? l.credit ?? 0,
        description: l.description,
      })),
    };
    return this.http.post<ApiResponse<JournalEntryResource>>(`${this.glBase}/journals`, normalizedPayload);
  }

  postJournal(id: string): Observable<ApiResponse<JournalEntryResource>> {
    return this.http.post<ApiResponse<JournalEntryResource>>(`${this.glBase}/journals/${id}/post`, {});
  }

  reverseJournal(id: string): Observable<ApiResponse<JournalEntryResource>> {
    return this.http.post<ApiResponse<JournalEntryResource>>(`${this.glBase}/journals/${id}/reverse`, {});
  }

  validateJournalBalance(lines: { account_id: string; debit_amount: number; credit_amount: number }[]): Observable<ApiResponse<{ balanced: boolean; difference: number }>> {
    return this.http.post<ApiResponse<{ balanced: boolean; difference: number }>>(`${this.glBase}/journals/validate-balance`, { lines });
  }

  // --- Fiscal Periods ---

  getFiscalPeriods(): Observable<ApiResponse<FiscalPeriodResource[]>> {
    return this.http.get<ApiResponse<FiscalPeriodResource[]>>(`${this.glBase}/fiscal-periods`);
  }

  closeFiscalPeriod(id: string): Observable<ApiResponse<FiscalPeriodResource>> {
    return this.http.post<ApiResponse<FiscalPeriodResource>>(`${this.glBase}/fiscal-periods/${id}/close`, {});
  }

  reopenFiscalPeriod(id: string): Observable<ApiResponse<FiscalPeriodResource>> {
    return this.http.post<ApiResponse<FiscalPeriodResource>>(`${this.glBase}/fiscal-periods/${id}/reopen`, {});
  }

  // --- Tax & VAT Settlements ---

  getTaxSettlements(params?: QueryFilterParams): Observable<PaginatedResponse<TaxSettlementResource>> {
    return this.http.get<PaginatedResponse<TaxSettlementResource>>(`${this.glBase}/tax-settlements`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  calculateTaxSettlement(payload: CalculateTaxSettlementPayload): Observable<ApiResponse<TaxSettlementResource>> {
    return this.http.post<ApiResponse<TaxSettlementResource>>(`${this.glBase}/tax-settlements/calculate`, payload);
  }

  postTaxSettlement(id: string): Observable<ApiResponse<TaxSettlementResource>> {
    return this.http.post<ApiResponse<TaxSettlementResource>>(`${this.glBase}/tax-settlements/${id}/post`, {});
  }

  payTaxSettlement(id: string): Observable<ApiResponse<TaxSettlementResource>> {
    return this.http.post<ApiResponse<TaxSettlementResource>>(`${this.glBase}/tax-settlements/${id}/pay`, {});
  }

  // --- Intrastat Declarations ---

  getIntrastatDeclarations(params?: QueryFilterParams): Observable<PaginatedResponse<IntrastatDeclarationResource>> {
    return this.http.get<PaginatedResponse<IntrastatDeclarationResource>>(`${this.intrastatBase}/declarations`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  generateIntrastatDeclaration(payload: GenerateIntrastatPayload): Observable<ApiResponse<IntrastatDeclarationResource>> {
    return this.http.post<ApiResponse<IntrastatDeclarationResource>>(`${this.intrastatBase}/declarations/generate`, payload);
  }

  /** 200 when the list is valid (it becomes validated), 422 with the errors otherwise. */
  validateIntrastatDeclaration(id: string): Observable<ApiResponse<IntrastatDeclarationResource>> {
    return this.http.post<ApiResponse<IntrastatDeclarationResource>>(`${this.intrastatBase}/declarations/${id}/validate`, {});
  }

  submitIntrastatDeclaration(id: string, payload: SubmitIntrastatPayload): Observable<ApiResponse<IntrastatDeclarationResource>> {
    return this.http.post<ApiResponse<IntrastatDeclarationResource>>(`${this.intrastatBase}/declarations/${id}/submit`, payload);
  }

  // --- Financial Statements ---

  getTrialBalance(year?: number): Observable<ApiResponse<TrialBalanceReport>> {
    return this.http.get<ApiResponse<TrialBalanceReport>>(`${this.glBase}/financial-statements/trial-balance`, {
      params: year ? toHttpParams({ year }) : undefined,
    });
  }

  // --- Backward Compatible Methods ---

  getChartOfAccounts(): Observable<ApiResponse<ChartOfAccount[]>> {
    return this.getAccounts();
  }

  getLedgerEntries(params?: QueryFilterParams): Observable<PaginatedResponse<JournalEntryResource>> {
    return this.getJournals(params);
  }

  createLedgerEntry(payload: CreateJournalEntryPayload): Observable<ApiResponse<JournalEntryResource>> {
    return this.createJournal(payload);
  }

  getVatSettlements(): Observable<ApiResponse<TaxSettlementResource[]>> {
    return this.http.get<ApiResponse<TaxSettlementResource[]>>(`${this.glBase}/tax-settlements`);
  }
}
