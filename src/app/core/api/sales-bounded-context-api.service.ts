import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SalesBoundedContextConfig,
  SalesBoundedContextOverview,
  SbcCommissionStatement,
  SbcCorporateWelfareConvention,
  SbcCpqConfiguration,
  SbcCpqQuote,
  SbcCustomerDossier,
  SbcDdtInvoice,
  SbcFrameworkOrder,
  SbcFranchisingAffiliate,
  SbcGdoRebateAgreement,
  SbcMarketingCampaign,
  SbcOmnichannelLead,
  SbcOpportunityForecast,
  SbcPortalTransaction,
  SbcPostDeliverySurvey,
  SbcPricingGuardrail,
  SbcPublicPrivateTender,
  SbcRecurringSubscription,
  SbcReverseLogisticsReturn,
  SbcVanSellingRoute,
} from '../models/sales-bounded-context.model';

@Injectable({ providedIn: 'root' })
export class SalesBoundedContextApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/sales-bounded-context`;

  getConfig(): Observable<{ data: SalesBoundedContextConfig }> {
    return this.http.get<{ data: SalesBoundedContextConfig }>(`${this.baseUrl}/config`);
  }

  getOverview(): Observable<{ data: SalesBoundedContextOverview }> {
    return this.http.get<{ data: SalesBoundedContextOverview }>(`${this.baseUrl}/overview`);
  }

  getDossiers(): Observable<{ data: SbcCustomerDossier[] }> {
    return this.http.get<{ data: SbcCustomerDossier[] }>(`${this.baseUrl}/dossiers`);
  }

  createDossier(payload: Record<string, unknown>): Observable<{ data: SbcCustomerDossier }> {
    return this.http.post<{ data: SbcCustomerDossier }>(`${this.baseUrl}/dossiers`, payload);
  }

  getLeads(): Observable<{ data: SbcOmnichannelLead[] }> {
    return this.http.get<{ data: SbcOmnichannelLead[] }>(`${this.baseUrl}/leads`);
  }

  captureLead(payload: Record<string, unknown>): Observable<{ data: SbcOmnichannelLead }> {
    return this.http.post<{ data: SbcOmnichannelLead }>(`${this.baseUrl}/leads`, payload);
  }

  getOpportunities(): Observable<{ data: SbcOpportunityForecast[] }> {
    return this.http.get<{ data: SbcOpportunityForecast[] }>(`${this.baseUrl}/opportunities`);
  }

  saveOpportunity(payload: Record<string, unknown>): Observable<{ data: SbcOpportunityForecast }> {
    return this.http.post<{ data: SbcOpportunityForecast }>(`${this.baseUrl}/opportunities`, payload);
  }

  getQuotes(): Observable<{ data: SbcCpqQuote[] }> {
    return this.http.get<{ data: SbcCpqQuote[] }>(`${this.baseUrl}/quotes`);
  }

  createQuote(payload: Record<string, unknown>): Observable<{ data: SbcCpqQuote }> {
    return this.http.post<{ data: SbcCpqQuote }>(`${this.baseUrl}/quotes`, payload);
  }

  signQuote(id: string, payload: Record<string, unknown>): Observable<{ data: SbcCpqQuote }> {
    return this.http.post<{ data: SbcCpqQuote }>(`${this.baseUrl}/quotes/${id}/sign`, payload);
  }

  convertQuoteToOrder(id: string): Observable<{ data: SbcCpqQuote }> {
    return this.http.post<{ data: SbcCpqQuote }>(`${this.baseUrl}/quotes/${id}/convert-to-order`, {});
  }

  getOrders(): Observable<{ data: SbcFrameworkOrder[] }> {
    return this.http.get<{ data: SbcFrameworkOrder[] }>(`${this.baseUrl}/orders`);
  }

  createOrder(payload: Record<string, unknown>): Observable<{ data: SbcFrameworkOrder }> {
    return this.http.post<{ data: SbcFrameworkOrder }>(`${this.baseUrl}/orders`, payload);
  }

  getPricingGuardrails(): Observable<{ data: SbcPricingGuardrail[] }> {
    return this.http.get<{ data: SbcPricingGuardrail[] }>(`${this.baseUrl}/pricing-guardrails`);
  }

  evaluatePricing(payload: Record<string, unknown>): Observable<{ data: SbcPricingGuardrail }> {
    return this.http.post<{ data: SbcPricingGuardrail }>(`${this.baseUrl}/pricing-guardrails`, payload);
  }

  approveMarginOverride(id: string, reason: string): Observable<{ data: SbcPricingGuardrail }> {
    return this.http.post<{ data: SbcPricingGuardrail }>(`${this.baseUrl}/pricing-guardrails/${id}/approve-override`, { reason });
  }

  getSubscriptions(): Observable<{ data: SbcRecurringSubscription[] }> {
    return this.http.get<{ data: SbcRecurringSubscription[] }>(`${this.baseUrl}/subscriptions`);
  }

  createSubscription(payload: Record<string, unknown>): Observable<{ data: SbcRecurringSubscription }> {
    return this.http.post<{ data: SbcRecurringSubscription }>(`${this.baseUrl}/subscriptions`, payload);
  }

  transitionSubscription(id: string, payload: Record<string, unknown>): Observable<{ data: SbcRecurringSubscription }> {
    return this.http.post<{ data: SbcRecurringSubscription }>(`${this.baseUrl}/subscriptions/${id}/transition`, payload);
  }

  getDdtInvoices(): Observable<{ data: SbcDdtInvoice[] }> {
    return this.http.get<{ data: SbcDdtInvoice[] }>(`${this.baseUrl}/ddt-invoices`);
  }

  issueDdtInvoice(payload: Record<string, unknown>): Observable<{ data: SbcDdtInvoice }> {
    return this.http.post<{ data: SbcDdtInvoice }>(`${this.baseUrl}/ddt-invoices`, payload);
  }

  getCommissions(): Observable<{ data: SbcCommissionStatement[] }> {
    return this.http.get<{ data: SbcCommissionStatement[] }>(`${this.baseUrl}/commissions`);
  }

  calculateCommission(payload: Record<string, unknown>): Observable<{ data: SbcCommissionStatement }> {
    return this.http.post<{ data: SbcCommissionStatement }>(`${this.baseUrl}/commissions`, payload);
  }

  getPortalTransactions(): Observable<{ data: SbcPortalTransaction[] }> {
    return this.http.get<{ data: SbcPortalTransaction[] }>(`${this.baseUrl}/portal-transactions`);
  }

  executePortalAction(payload: Record<string, unknown>): Observable<{ data: SbcPortalTransaction }> {
    return this.http.post<{ data: SbcPortalTransaction }>(`${this.baseUrl}/portal-transactions`, payload);
  }

  getMarketingCampaigns(): Observable<{ data: SbcMarketingCampaign[] }> {
    return this.http.get<{ data: SbcMarketingCampaign[] }>(`${this.baseUrl}/marketing-campaigns`);
  }

  executeMarketingCampaign(payload: Record<string, unknown>): Observable<{ data: SbcMarketingCampaign }> {
    return this.http.post<{ data: SbcMarketingCampaign }>(`${this.baseUrl}/marketing-campaigns`, payload);
  }

  getTenders(): Observable<{ data: SbcPublicPrivateTender[] }> {
    return this.http.get<{ data: SbcPublicPrivateTender[] }>(`${this.baseUrl}/tenders`);
  }

  submitTender(payload: Record<string, unknown>): Observable<{ data: SbcPublicPrivateTender }> {
    return this.http.post<{ data: SbcPublicPrivateTender }>(`${this.baseUrl}/tenders`, payload);
  }

  convertTenderToContract(id: string): Observable<{ data: SbcPublicPrivateTender }> {
    return this.http.post<{ data: SbcPublicPrivateTender }>(`${this.baseUrl}/tenders/${id}/convert-contract`, {});
  }

  getCpqConfigurations(): Observable<{ data: SbcCpqConfiguration[] }> {
    return this.http.get<{ data: SbcCpqConfiguration[] }>(`${this.baseUrl}/cpq-configurations`);
  }

  configureCpqBom(payload: Record<string, unknown>): Observable<{ data: SbcCpqConfiguration }> {
    return this.http.post<{ data: SbcCpqConfiguration }>(`${this.baseUrl}/cpq-configurations`, payload);
  }

  getGdoRebates(): Observable<{ data: SbcGdoRebateAgreement[] }> {
    return this.http.get<{ data: SbcGdoRebateAgreement[] }>(`${this.baseUrl}/gdo-rebates`);
  }

  calculateGdoRebate(payload: Record<string, unknown>): Observable<{ data: SbcGdoRebateAgreement }> {
    return this.http.post<{ data: SbcGdoRebateAgreement }>(`${this.baseUrl}/gdo-rebates`, payload);
  }

  settleGdoRebateCreditNote(id: string): Observable<{ data: SbcGdoRebateAgreement }> {
    return this.http.post<{ data: SbcGdoRebateAgreement }>(`${this.baseUrl}/gdo-rebates/${id}/settle-credit-note`, {});
  }

  getReverseReturns(): Observable<{ data: SbcReverseLogisticsReturn[] }> {
    return this.http.get<{ data: SbcReverseLogisticsReturn[] }>(`${this.baseUrl}/reverse-returns`);
  }

  processReverseReturn(payload: Record<string, unknown>): Observable<{ data: SbcReverseLogisticsReturn }> {
    return this.http.post<{ data: SbcReverseLogisticsReturn }>(`${this.baseUrl}/reverse-returns`, payload);
  }

  getVanRoutes(): Observable<{ data: SbcVanSellingRoute[] }> {
    return this.http.get<{ data: SbcVanSellingRoute[] }>(`${this.baseUrl}/van-routes`);
  }

  reconcileVanRoute(payload: Record<string, unknown>): Observable<{ data: SbcVanSellingRoute }> {
    return this.http.post<{ data: SbcVanSellingRoute }>(`${this.baseUrl}/van-routes`, payload);
  }

  getFranchisingAffiliates(): Observable<{ data: SbcFranchisingAffiliate[] }> {
    return this.http.get<{ data: SbcFranchisingAffiliate[] }>(`${this.baseUrl}/franchising-affiliates`);
  }

  calculateFranchisingRoyalty(payload: Record<string, unknown>): Observable<{ data: SbcFranchisingAffiliate }> {
    return this.http.post<{ data: SbcFranchisingAffiliate }>(`${this.baseUrl}/franchising-affiliates`, payload);
  }

  getSurveys(): Observable<{ data: SbcPostDeliverySurvey[] }> {
    return this.http.get<{ data: SbcPostDeliverySurvey[] }>(`${this.baseUrl}/surveys`);
  }

  recordSurvey(payload: Record<string, unknown>): Observable<{ data: SbcPostDeliverySurvey }> {
    return this.http.post<{ data: SbcPostDeliverySurvey }>(`${this.baseUrl}/surveys`, payload);
  }

  getWelfareConventions(): Observable<{ data: SbcCorporateWelfareConvention[] }> {
    return this.http.get<{ data: SbcCorporateWelfareConvention[] }>(`${this.baseUrl}/welfare-conventions`);
  }

  processWelfareSplitBilling(payload: Record<string, unknown>): Observable<{ data: SbcCorporateWelfareConvention }> {
    return this.http.post<{ data: SbcCorporateWelfareConvention }>(`${this.baseUrl}/welfare-conventions`, payload);
  }
}
