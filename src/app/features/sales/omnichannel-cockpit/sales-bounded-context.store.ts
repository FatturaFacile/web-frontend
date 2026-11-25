import { computed, inject } from '@angular/core';
import {
  SalesBoundedContextApiService,
  SalesBoundedContextConfig,
  SalesBoundedContextOverview,
  SbcCommissionStatement,
  SbcCpqQuote,
  SbcCustomerDossier,
  SbcDdtInvoice,
  SbcFrameworkOrder,
  SbcOmnichannelLead,
  SbcOpportunityForecast,
  SbcPortalTransaction,
  SbcPricingGuardrail,
  SbcRecurringSubscription,
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
};

export const SalesBoundedContextStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    ui: computed(() => state.config()?.ui_copy ?? {}),
    pendingGuardrailsCount: computed(
      () => state.pricingGuardrails().filter((g) => g.approval_status === 'pending_manager_approval').length,
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
  })),
);
