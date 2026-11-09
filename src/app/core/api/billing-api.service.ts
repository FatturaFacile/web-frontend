import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  BillingPlan,
  BillingPlanFilterParams,
  BillingPlanPayload,
  CommissionPeriodPayload,
  CommissionSettingsPayload,
  CommissionStatement,
  CustomerAging,
  CustomerCreditProfile,
  CustomerLedgerEntry,
  DebitNotePayload,
  DeclarationOfIntent,
  DeclarationOfIntentPayload,
  DeferredInvoicePayload,
  DeferredRunPayload,
  DownPaymentInvoicePayload,
  BillingDocumentOptions,
  InvoiceApprovalMatrix,
  InvoiceApprovalMatrixPayload,
  InvoiceFromOrderPayload,
  InvoiceReminder,
  PaginatedResponse,
  PaymentImport,
  ProductCharge,
  ProductChargePayload,
  ProductChargePreviewPayload,
  ProductChargeRatePayload,
  ReceivablesAgingReport,
  SalesRegisterParams,
  SalesRegisterReport,
  SalesTargetPayload,
  SalesTeamPayload,
} from '../models';

/** Order billing, billing plans, debit notes, reports, customer credit and approvals (`/invoicing/*`). */
@Service()
export class BillingApiService {
  private readonly http = inject(HttpClient);
  private readonly invoicing = `${environment.apiBaseUrl}/invoicing`;
  private readonly sales = `${environment.apiBaseUrl}/sales`;

  // Order billing
  invoiceFromOrder(orderId: string, payload: InvoiceFromOrderPayload = {}): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/invoices/from-order/${orderId}`, payload);
  }

  createDownPaymentInvoice(
    orderId: string,
    payload: DownPaymentInvoicePayload,
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/orders/${orderId}/down-payment-invoices`, payload);
  }

  createDeferredInvoice(payload: DeferredInvoicePayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/invoices/deferred`, payload);
  }

  runDeferredBilling(payload: DeferredRunPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/invoices/deferred-run`, payload);
  }

  createDebitNote(payload: DebitNotePayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/debit-notes`, payload);
  }

  // Billing plans
  getBillingPlans(params?: BillingPlanFilterParams): Observable<PaginatedResponse<BillingPlan>> {
    return this.http.get<PaginatedResponse<BillingPlan>>(`${this.invoicing}/billing-plans`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getBillingPlan(id: string): Observable<ApiResponse<BillingPlan>> {
    return this.http.get<ApiResponse<BillingPlan>>(`${this.invoicing}/billing-plans/${id}`);
  }

  createBillingPlan(payload: BillingPlanPayload): Observable<ApiResponse<BillingPlan>> {
    return this.http.post<ApiResponse<BillingPlan>>(`${this.invoicing}/billing-plans`, payload);
  }

  invoiceBillingPlanItem(
    planId: string,
    itemId: string,
    payload: BillingDocumentOptions = {},
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.invoicing}/billing-plans/${planId}/items/${itemId}/invoice`,
      payload,
    );
  }

  runBillingPlans(upToDate: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/billing-plans/run`, { up_to_date: upToDate });
  }

  cancelBillingPlan(id: string): Observable<ApiResponse<BillingPlan>> {
    return this.http.post<ApiResponse<BillingPlan>>(`${this.invoicing}/billing-plans/${id}/cancel`, {});
  }

  // Reports and customer ledger
  getSalesRegister(params: SalesRegisterParams): Observable<ApiResponse<SalesRegisterReport>> {
    return this.http.get<ApiResponse<SalesRegisterReport>>(`${this.invoicing}/reports/sales-register`, {
      params: toHttpParams(params),
    });
  }

  getReceivablesAging(params?: { as_of?: string; customer_id?: string }): Observable<ApiResponse<ReceivablesAgingReport>> {
    return this.http.get<ApiResponse<ReceivablesAgingReport>>(`${this.invoicing}/reports/receivables-aging`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCustomerStatement(
    customerId: string,
    params?: { page?: number; per_page?: number },
  ): Observable<PaginatedResponse<CustomerLedgerEntry>> {
    return this.http.get<PaginatedResponse<CustomerLedgerEntry>>(
      `${this.invoicing}/customer-ledger/${customerId}/statement`,
      { params: params ? toHttpParams(params) : undefined },
    );
  }

  getCustomerAging(customerId: string): Observable<ApiResponse<CustomerAging>> {
    return this.http.get<ApiResponse<CustomerAging>>(`${this.invoicing}/customer-ledger/${customerId}/aging`);
  }

  // Customer credit
  getCustomerCredit(customerId: string): Observable<ApiResponse<CustomerCreditProfile>> {
    return this.http.get<ApiResponse<CustomerCreditProfile>>(`${this.invoicing}/customer-credit/${customerId}`);
  }

  setCustomerCreditLimit(
    customerId: string,
    creditLimit: number | string,
  ): Observable<ApiResponse<CustomerCreditProfile>> {
    return this.http.post<ApiResponse<CustomerCreditProfile>>(`${this.invoicing}/customer-credit/limit`, {
      customer_id: customerId,
      credit_limit: creditLimit,
    });
  }

  releaseCreditHold(holdId: string, notes?: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.invoicing}/customer-credit/holds/${holdId}/release`,
      notes ? { notes } : {},
    );
  }

  // Payment imports and reminders (`/sales`)
  getPaymentImports(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<PaymentImport>> {
    return this.http.get<PaginatedResponse<PaymentImport>>(`${this.sales}/payment-imports`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getPaymentImport(id: string): Observable<ApiResponse<PaymentImport>> {
    return this.http.get<ApiResponse<PaymentImport>>(`${this.sales}/payment-imports/${id}`);
  }

  uploadPaymentImport(file: File): Observable<ApiResponse<PaymentImport>> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ApiResponse<PaymentImport>>(`${this.sales}/payment-imports`, body);
  }

  matchPaymentImportLine(importId: string, lineId: string, invoiceId: string): Observable<ApiResponse<PaymentImport>> {
    return this.http.post<ApiResponse<PaymentImport>>(
      `${this.sales}/payment-imports/${importId}/lines/${lineId}/match`,
      { invoice_id: invoiceId },
    );
  }

  getInvoiceReminders(invoiceId: string): Observable<ApiResponse<InvoiceReminder[]>> {
    return this.http.get<ApiResponse<InvoiceReminder[]>>(`${this.sales}/invoices/${invoiceId}/reminders`);
  }

  sendInvoiceReminder(invoiceId: string): Observable<ApiResponse<InvoiceReminder>> {
    return this.http.post<ApiResponse<InvoiceReminder>>(`${this.sales}/invoices/${invoiceId}/reminders`, {});
  }

  // Declarations of intent
  getDeclarationsOfIntent(params?: {
    contact_id?: string;
    direction?: string;
    year?: string;
  }): Observable<ApiResponse<DeclarationOfIntent[]>> {
    return this.http.get<ApiResponse<DeclarationOfIntent[]>>(`${this.invoicing}/declarations-of-intent`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDeclarationsOfIntentSummary(year: number): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.invoicing}/declarations-of-intent/summary`, {
      params: toHttpParams({ year }),
    });
  }

  getDeclarationOfIntent(id: string): Observable<ApiResponse<DeclarationOfIntent>> {
    return this.http.get<ApiResponse<DeclarationOfIntent>>(`${this.invoicing}/declarations-of-intent/${id}`);
  }

  createDeclarationOfIntent(payload: DeclarationOfIntentPayload): Observable<ApiResponse<DeclarationOfIntent>> {
    return this.http.post<ApiResponse<DeclarationOfIntent>>(`${this.invoicing}/declarations-of-intent`, payload);
  }

  updateDeclarationOfIntent(
    id: string,
    payload: DeclarationOfIntentPayload,
  ): Observable<ApiResponse<DeclarationOfIntent>> {
    return this.http.put<ApiResponse<DeclarationOfIntent>>(
      `${this.invoicing}/declarations-of-intent/${id}`,
      payload,
    );
  }

  deleteDeclarationOfIntent(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.invoicing}/declarations-of-intent/${id}`);
  }

  // Product charges (eco-contributions)
  getProductCharges(): Observable<ApiResponse<ProductCharge[]>> {
    return this.http.get<ApiResponse<ProductCharge[]>>(`${this.invoicing}/product-charges`);
  }

  createProductCharge(payload: ProductChargePayload): Observable<ApiResponse<ProductCharge>> {
    return this.http.post<ApiResponse<ProductCharge>>(`${this.invoicing}/product-charges`, payload);
  }

  previewProductCharges(payload: ProductChargePreviewPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/product-charges/preview`, payload);
  }

  addProductChargeRate(id: string, payload: ProductChargeRatePayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/product-charges/${id}/rates`, payload);
  }

  attachProductChargeProduct(
    id: string,
    payload: { product_id: string; quantity_per_unit?: number | string | null },
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/product-charges/${id}/products`, payload);
  }

  // Invoice approval matrices
  getApprovalMatrices(): Observable<ApiResponse<InvoiceApprovalMatrix[]>> {
    return this.http.get<ApiResponse<InvoiceApprovalMatrix[]>>(
      `${environment.apiBaseUrl}/invoice-approvals/matrices`,
    );
  }

  createApprovalMatrix(payload: InvoiceApprovalMatrixPayload): Observable<ApiResponse<InvoiceApprovalMatrix>> {
    return this.http.post<ApiResponse<InvoiceApprovalMatrix>>(
      `${environment.apiBaseUrl}/invoice-approvals/matrices`,
      payload,
    );
  }

  deleteApprovalMatrix(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${environment.apiBaseUrl}/invoice-approvals/matrices/${id}`);
  }

  // Commissions and targets
  createSalesTeam(payload: SalesTeamPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/sales-teams`, payload);
  }

  createSalesTarget(payload: SalesTargetPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/sales-targets`, payload);
  }

  getSalesTargetAttainment(params: {
    from: string;
    to: string;
    sales_representative_id?: string;
  }): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.invoicing}/sales-targets/attainment`, {
      params: toHttpParams(params),
    });
  }

  accrueCommissions(payload: CommissionPeriodPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.invoicing}/commissions/accrue`, payload);
  }

  getCommissionStatements(): Observable<ApiResponse<CommissionStatement[]>> {
    return this.http.get<ApiResponse<CommissionStatement[]>>(`${this.invoicing}/commission-statements`);
  }

  createCommissionStatement(payload: CommissionPeriodPayload): Observable<ApiResponse<CommissionStatement>> {
    return this.http.post<ApiResponse<CommissionStatement>>(`${this.invoicing}/commission-statements`, payload);
  }

  approveCommissionStatement(id: string): Observable<ApiResponse<CommissionStatement>> {
    return this.http.post<ApiResponse<CommissionStatement>>(
      `${this.invoicing}/commission-statements/${id}/approve`,
      {},
    );
  }

  postCommissionStatement(id: string): Observable<ApiResponse<CommissionStatement>> {
    return this.http.post<ApiResponse<CommissionStatement>>(
      `${this.invoicing}/commission-statements/${id}/post`,
      {},
    );
  }

  markCommissionStatementPaid(id: string): Observable<ApiResponse<CommissionStatement>> {
    return this.http.post<ApiResponse<CommissionStatement>>(
      `${this.invoicing}/commission-statements/${id}/paid`,
      {},
    );
  }

  setCommissionSettings(payload: CommissionSettingsPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.invoicing}/commission-settings`, payload);
  }
}
