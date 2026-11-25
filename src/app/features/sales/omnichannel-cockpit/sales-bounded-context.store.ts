import { computed, inject } from '@angular/core';
import {
  SalesBoundedContextApiService,
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
} from '@core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

export interface SalesBoundedContextState {
  loading: boolean;
  config: SalesBoundedContextConfig | null;
  overview: SalesBoundedContextOverview | null;
  dossiers: SbcCustomerDossier[];
  leads: SbcOmnichannelLead[];
  opportunities: SbcOpportunityForecast[];
  quotes: SbcCpqQuote[];
  orders: SbcFrameworkOrder[];
  pricingGuardrails: SbcPricingGuardrail[];
  subscriptions: SbcRecurringSubscription[];
  ddtInvoices: SbcDdtInvoice[];
  commissions: SbcCommissionStatement[];
  portalTransactions: SbcPortalTransaction[];
  marketingCampaigns: SbcMarketingCampaign[];
  tenders: SbcPublicPrivateTender[];
  cpqConfigurations: SbcCpqConfiguration[];
  gdoRebates: SbcGdoRebateAgreement[];
  reverseReturns: SbcReverseLogisticsReturn[];
  vanRoutes: SbcVanSellingRoute[];
  franchisingAffiliates: SbcFranchisingAffiliate[];
  surveys: SbcPostDeliverySurvey[];
  welfareConventions: SbcCorporateWelfareConvention[];
}

const initialState: SalesBoundedContextState = {
  loading: false,
  config: null,
  overview: null,
  dossiers: [],
  leads: [],
  opportunities: [],
  quotes: [],
  orders: [],
  pricingGuardrails: [],
  subscriptions: [],
  ddtInvoices: [],
  commissions: [],
  portalTransactions: [],
  marketingCampaigns: [],
  tenders: [],
  cpqConfigurations: [],
  gdoRebates: [],
  reverseReturns: [],
  vanRoutes: [],
  franchisingAffiliates: [],
  surveys: [],
  welfareConventions: [],
};

export const SalesBoundedContextStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    ui: computed(() => state.config()?.ui_copy ?? {}),
    pendingGuardrailsCount: computed(
      () => state.pricingGuardrails().filter((g) => g.approval_status === 'pending_manager_approval').length,
    ),
    detractorAlertsCount: computed(
      () => state.surveys().filter((s) => s.detractor_recovery_alert_triggered).length,
    ),
    unsettledRebatesCount: computed(
      () => state.gdoRebates().filter((r) => r.settlement_status !== 'settled_credit_note').length,
    ),
  })),
  withMethods((store, api = inject(SalesBoundedContextApiService)) => ({
    async loadAll(): Promise<void> {
      patchState(store, { loading: true });
      try {
        const [
          configRes,
          overviewRes,
          dossiersRes,
          leadsRes,
          oppsRes,
          quotesRes,
          ordersRes,
          pricingRes,
          subsRes,
          ddtRes,
          commRes,
          portalRes,
          mktRes,
          tendersRes,
          cpqCfgRes,
          gdoRes,
          returnsRes,
          vanRes,
          franchiseRes,
          surveysRes,
          welfareRes,
        ] = await Promise.all([
          firstValueFrom(api.getConfig()),
          firstValueFrom(api.getOverview()),
          firstValueFrom(api.getDossiers()),
          firstValueFrom(api.getLeads()),
          firstValueFrom(api.getOpportunities()),
          firstValueFrom(api.getQuotes()),
          firstValueFrom(api.getOrders()),
          firstValueFrom(api.getPricingGuardrails()),
          firstValueFrom(api.getSubscriptions()),
          firstValueFrom(api.getDdtInvoices()),
          firstValueFrom(api.getCommissions()),
          firstValueFrom(api.getPortalTransactions()),
          firstValueFrom(api.getMarketingCampaigns()),
          firstValueFrom(api.getTenders()),
          firstValueFrom(api.getCpqConfigurations()),
          firstValueFrom(api.getGdoRebates()),
          firstValueFrom(api.getReverseReturns()),
          firstValueFrom(api.getVanRoutes()),
          firstValueFrom(api.getFranchisingAffiliates()),
          firstValueFrom(api.getSurveys()),
          firstValueFrom(api.getWelfareConventions()),
        ]);

        patchState(store, {
          config: configRes.data,
          overview: overviewRes.data,
          dossiers: dossiersRes.data,
          leads: leadsRes.data,
          opportunities: oppsRes.data,
          quotes: quotesRes.data,
          orders: ordersRes.data,
          pricingGuardrails: pricingRes.data,
          subscriptions: subsRes.data,
          ddtInvoices: ddtRes.data,
          commissions: commRes.data,
          portalTransactions: portalRes.data,
          marketingCampaigns: mktRes.data,
          tenders: tendersRes.data,
          cpqConfigurations: cpqCfgRes.data,
          gdoRebates: gdoRes.data,
          reverseReturns: returnsRes.data,
          vanRoutes: vanRes.data,
          franchisingAffiliates: franchiseRes.data,
          surveys: surveysRes.data,
          welfareConventions: welfareRes.data,
        });
      } finally {
        patchState(store, { loading: false });
      }
    },

    async createDossier(payload: Record<string, unknown>): Promise<SbcCustomerDossier> {
      const res = await firstValueFrom(api.createDossier(payload));
      patchState(store, { dossiers: [res.data, ...store.dossiers()] });
      return res.data;
    },

    async captureLead(payload: Record<string, unknown>): Promise<SbcOmnichannelLead> {
      const res = await firstValueFrom(api.captureLead(payload));
      patchState(store, { leads: [res.data, ...store.leads()] });
      return res.data;
    },

    async saveOpportunity(payload: Record<string, unknown>): Promise<SbcOpportunityForecast> {
      const res = await firstValueFrom(api.saveOpportunity(payload));
      patchState(store, { opportunities: [res.data, ...store.opportunities()] });
      return res.data;
    },

    async createQuote(payload: Record<string, unknown>): Promise<SbcCpqQuote> {
      const res = await firstValueFrom(api.createQuote(payload));
      patchState(store, { quotes: [res.data, ...store.quotes()] });
      return res.data;
    },

    async signQuote(id: string, payload: Record<string, unknown>): Promise<SbcCpqQuote> {
      const res = await firstValueFrom(api.signQuote(id, payload));
      patchState(store, {
        quotes: store.quotes().map((q) => (q.id === id ? res.data : q)),
      });
      return res.data;
    },

    async convertQuoteToOrder(id: string): Promise<SbcCpqQuote> {
      const res = await firstValueFrom(api.convertQuoteToOrder(id));
      patchState(store, {
        quotes: store.quotes().map((q) => (q.id === id ? res.data : q)),
      });
      return res.data;
    },

    async createOrder(payload: Record<string, unknown>): Promise<SbcFrameworkOrder> {
      const res = await firstValueFrom(api.createOrder(payload));
      patchState(store, { orders: [res.data, ...store.orders()] });
      return res.data;
    },

    async evaluatePricing(payload: Record<string, unknown>): Promise<SbcPricingGuardrail> {
      const res = await firstValueFrom(api.evaluatePricing(payload));
      patchState(store, { pricingGuardrails: [res.data, ...store.pricingGuardrails()] });
      return res.data;
    },

    async approveMarginOverride(id: string, reason: string): Promise<SbcPricingGuardrail> {
      const res = await firstValueFrom(api.approveMarginOverride(id, reason));
      patchState(store, {
        pricingGuardrails: store.pricingGuardrails().map((g) => (g.id === id ? res.data : g)),
      });
      return res.data;
    },

    async createSubscription(payload: Record<string, unknown>): Promise<SbcRecurringSubscription> {
      const res = await firstValueFrom(api.createSubscription(payload));
      patchState(store, { subscriptions: [res.data, ...store.subscriptions()] });
      return res.data;
    },

    async transitionSubscription(
      id: string,
      payload: Record<string, unknown>,
    ): Promise<SbcRecurringSubscription> {
      const res = await firstValueFrom(api.transitionSubscription(id, payload));
      patchState(store, {
        subscriptions: store.subscriptions().map((s) => (s.id === id ? res.data : s)),
      });
      return res.data;
    },

    async issueDdtInvoice(payload: Record<string, unknown>): Promise<SbcDdtInvoice> {
      const res = await firstValueFrom(api.issueDdtInvoice(payload));
      patchState(store, { ddtInvoices: [res.data, ...store.ddtInvoices()] });
      return res.data;
    },

    async calculateCommission(payload: Record<string, unknown>): Promise<SbcCommissionStatement> {
      const res = await firstValueFrom(api.calculateCommission(payload));
      patchState(store, { commissions: [res.data, ...store.commissions()] });
      return res.data;
    },

    async executePortalAction(payload: Record<string, unknown>): Promise<SbcPortalTransaction> {
      const res = await firstValueFrom(api.executePortalAction(payload));
      patchState(store, { portalTransactions: [res.data, ...store.portalTransactions()] });
      return res.data;
    },

    async executeMarketingCampaign(payload: Record<string, unknown>): Promise<SbcMarketingCampaign> {
      const res = await firstValueFrom(api.executeMarketingCampaign(payload));
      patchState(store, { marketingCampaigns: [res.data, ...store.marketingCampaigns()] });
      return res.data;
    },

    async submitTender(payload: Record<string, unknown>): Promise<SbcPublicPrivateTender> {
      const res = await firstValueFrom(api.submitTender(payload));
      patchState(store, { tenders: [res.data, ...store.tenders()] });
      return res.data;
    },

    async convertTenderToContract(id: string): Promise<SbcPublicPrivateTender> {
      const res = await firstValueFrom(api.convertTenderToContract(id));
      patchState(store, {
        tenders: store.tenders().map((t) => (t.id === id ? res.data : t)),
      });
      return res.data;
    },

    async configureCpqBom(payload: Record<string, unknown>): Promise<SbcCpqConfiguration> {
      const res = await firstValueFrom(api.configureCpqBom(payload));
      patchState(store, { cpqConfigurations: [res.data, ...store.cpqConfigurations()] });
      return res.data;
    },

    async calculateGdoRebate(payload: Record<string, unknown>): Promise<SbcGdoRebateAgreement> {
      const res = await firstValueFrom(api.calculateGdoRebate(payload));
      patchState(store, { gdoRebates: [res.data, ...store.gdoRebates()] });
      return res.data;
    },

    async settleGdoRebateCreditNote(id: string): Promise<SbcGdoRebateAgreement> {
      const res = await firstValueFrom(api.settleGdoRebateCreditNote(id));
      patchState(store, {
        gdoRebates: store.gdoRebates().map((r) => (r.id === id ? res.data : r)),
      });
      return res.data;
    },

    async processReverseReturn(payload: Record<string, unknown>): Promise<SbcReverseLogisticsReturn> {
      const res = await firstValueFrom(api.processReverseReturn(payload));
      patchState(store, { reverseReturns: [res.data, ...store.reverseReturns()] });
      return res.data;
    },

    async reconcileVanRoute(payload: Record<string, unknown>): Promise<SbcVanSellingRoute> {
      const res = await firstValueFrom(api.reconcileVanRoute(payload));
      patchState(store, { vanRoutes: [res.data, ...store.vanRoutes()] });
      return res.data;
    },

    async calculateFranchisingRoyalty(payload: Record<string, unknown>): Promise<SbcFranchisingAffiliate> {
      const res = await firstValueFrom(api.calculateFranchisingRoyalty(payload));
      patchState(store, { franchisingAffiliates: [res.data, ...store.franchisingAffiliates()] });
      return res.data;
    },

    async recordSurvey(payload: Record<string, unknown>): Promise<SbcPostDeliverySurvey> {
      const res = await firstValueFrom(api.recordSurvey(payload));
      patchState(store, { surveys: [res.data, ...store.surveys()] });
      return res.data;
    },

    async processWelfareSplitBilling(payload: Record<string, unknown>): Promise<SbcCorporateWelfareConvention> {
      const res = await firstValueFrom(api.processWelfareSplitBilling(payload));
      patchState(store, { welfareConventions: [res.data, ...store.welfareConventions()] });
      return res.data;
    },
  })),
);
