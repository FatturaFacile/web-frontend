import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AbTestStats,
  CatalogProduct,
  ComplianceStrategyInfo,
  ConsentEvent,
  DynamicCustomerSegment,
  EmailTemplate,
  JourneyStep,
  JourneyStepLog,
  MarketingAutomationApiService,
  MarketingBlueprint,
  MarketingCampaign,
  MarketingConsent,
  MarketingLocale,
  RfmMatrix,
  RoiDashboard,
  SaveCampaignPayload,
  SaveSegmentPayload,
  SegmentCriteria,
  SegmentPreview,
  TemplatePreview,
  UpdateConsentPayload,
} from '@core';
import { problemOf, validationMessages } from './marketing-automation.util';

export interface MarketingAutomationState {
  dashboard: RoiDashboard | null;
  segments: DynamicCustomerSegment[];
  segmentPreview: SegmentPreview | null;
  rfmMatrix: RfmMatrix | null;
  campaigns: MarketingCampaign[];
  /** The campaign open in the designer or the journey builder. */
  selectedCampaign: MarketingCampaign | null;
  blueprints: MarketingBlueprint[];
  products: CatalogProduct[];
  preview: TemplatePreview | null;
  stepLogs: JourneyStepLog[];
  abStats: AbTestStats | null;
  consents: MarketingConsent[];
  consentEvents: ConsentEvent[];
  strategies: ComplianceStrategyInfo[];
  loading: boolean;
  saving: boolean;
  /** Key of a seeded text (`marketing.problem.<code>`) or null. */
  errorCode: string | null;
  /** Validation messages of the last rejected save. */
  errorDetails: string[];
}

const initialState: MarketingAutomationState = {
  dashboard: null,
  segments: [],
  segmentPreview: null,
  rfmMatrix: null,
  campaigns: [],
  selectedCampaign: null,
  blueprints: [],
  products: [],
  preview: null,
  stepLogs: [],
  abStats: null,
  consents: [],
  consentEvents: [],
  strategies: [],
  loading: false,
  saving: false,
  errorCode: null,
  errorDetails: [],
};

/** State of the Marketing Automation hub (Mod 155): dashboard, RFM segments, campaigns, designer, journeys, consent. */
export const MarketingAutomationStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    presets: computed(() => store.blueprints().filter((b) => b.kind === 'segment_preset')),
    templates: computed(() => store.blueprints().filter((b) => b.kind === 'email_template')),
    journeys: computed(() => store.blueprints().filter((b) => b.kind === 'journey')),
    selectedSegment: computed(() => {
      const campaign = store.selectedCampaign();
      return campaign?.segment_id
        ? (store.segments().find((s) => s.id === campaign.segment_id) ?? null)
        : null;
    }),
  })),
  withMethods((store, api = inject(MarketingAutomationApiService)) => {
    /** Runs a call, keeps the error code of a rejected one and tells the caller whether it worked. */
    function setBusy(flag: 'loading' | 'saving', value: boolean): void {
      patchState(store, flag === 'loading' ? { loading: value } : { saving: value });
    }

    async function attempt<T>(work: () => Promise<T>, flag: 'loading' | 'saving'): Promise<T | null> {
      setBusy(flag, true);
      patchState(store, { errorCode: null, errorDetails: [] });
      try {
        return await work();
      } catch (error) {
        const problem = problemOf(error);
        patchState(store, {
          errorCode: problem ? `marketing.problem.${problem.code}` : 'marketing.problem.generic',
          errorDetails: validationMessages(error),
        });
        return null;
      } finally {
        setBusy(flag, false);
      }
    }

    return {
      clearError(): void {
        patchState(store, { errorCode: null, errorDetails: [] });
      },

      async loadDashboard(): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.getDashboard());
          patchState(store, { dashboard: response.data });
        }, 'loading');
      },

      async loadBlueprints(): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.getBlueprints());
          patchState(store, { blueprints: response.data });
        }, 'loading');
      },

      async loadSegments(): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.getSegments());
          patchState(store, { segments: response.data });
        }, 'loading');
      },

      async previewSegment(criteria: SegmentCriteria): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.previewSegment(criteria));
          patchState(store, { segmentPreview: response.data });
        }, 'loading');
      },

      async saveSegment(
        payload: SaveSegmentPayload,
        id?: string,
      ): Promise<DynamicCustomerSegment | null> {
        return attempt(async () => {
          const response = await firstValueFrom(
            id ? api.updateSegment(id, payload) : api.createSegment(payload),
          );
          const saved = response.data;
          patchState(store, {
            segments: id
              ? store.segments().map((s) => (s.id === saved.id ? saved : s))
              : [...store.segments(), saved],
          });
          return saved;
        }, 'saving');
      },

      async evaluateSegment(id: string): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.evaluateSegment(id));
          patchState(store, {
            segments: store.segments().map((s) => (s.id === id ? response.data : s)),
          });
          const matrix = await firstValueFrom(api.getRfmMatrix(id));
          patchState(store, { rfmMatrix: matrix.data });
        }, 'loading');
      },

      async deleteSegment(id: string): Promise<void> {
        await attempt(async () => {
          await firstValueFrom(api.deleteSegment(id));
          patchState(store, {
            segments: store.segments().filter((s) => s.id !== id),
            rfmMatrix: store.rfmMatrix()?.segment_id === id ? null : store.rfmMatrix(),
          });
        }, 'saving');
      },

      async loadRfmMatrix(id: string): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.getRfmMatrix(id));
          patchState(store, { rfmMatrix: response.data });
        }, 'loading');
      },

      async loadCampaigns(): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.getCampaigns());
          patchState(store, { campaigns: response.data });
        }, 'loading');
      },

      async selectCampaign(id: string | null): Promise<void> {
        if (id === null) {
          patchState(store, { selectedCampaign: null, preview: null, stepLogs: [], abStats: null });
          return;
        }
        await attempt(async () => {
          const response = await firstValueFrom(api.getCampaign(id));
          patchState(store, { selectedCampaign: response.data, preview: null });
        }, 'loading');
      },

      async saveCampaign(
        payload: SaveCampaignPayload,
        id?: string,
      ): Promise<MarketingCampaign | null> {
        return attempt(async () => {
          const response = await firstValueFrom(
            id ? api.updateCampaign(id, payload) : api.createCampaign(payload),
          );
          const saved = response.data;
          patchState(store, {
            campaigns: id
              ? store.campaigns().map((c) => (c.id === saved.id ? saved : c))
              : [saved, ...store.campaigns()],
            selectedCampaign:
              store.selectedCampaign()?.id === saved.id || !id ? saved : store.selectedCampaign(),
          });
          return saved;
        }, 'saving');
      },

      async deleteCampaign(id: string): Promise<void> {
        await attempt(async () => {
          await firstValueFrom(api.deleteCampaign(id));
          patchState(store, { campaigns: store.campaigns().filter((c) => c.id !== id) });
        }, 'saving');
      },

      async transition(
        id: string,
        action: 'activate' | 'schedule' | 'pause' | 'archive',
      ): Promise<MarketingCampaign | null> {
        return attempt(async () => {
          const response = await firstValueFrom(api.transitionCampaign(id, action));
          const updated = response.data;
          patchState(store, {
            campaigns: store.campaigns().map((c) => (c.id === updated.id ? updated : c)),
            selectedCampaign:
              store.selectedCampaign()?.id === updated.id ? updated : store.selectedCampaign(),
          });
          return updated;
        }, 'saving');
      },

      async saveTemplate(
        id: string,
        template: EmailTemplate,
        abTest: SaveCampaignPayload['ab_test_split_variant_json'],
      ): Promise<MarketingCampaign | null> {
        return attempt(async () => {
          const response = await firstValueFrom(
            api.updateCampaign(id, { template_mjml_json: template, ab_test_split_variant_json: abTest }),
          );
          patchState(store, {
            selectedCampaign: response.data,
            campaigns: store.campaigns().map((c) => (c.id === id ? response.data : c)),
          });
          return response.data;
        }, 'saving');
      },

      async saveJourney(id: string, steps: JourneyStep[]): Promise<MarketingCampaign | null> {
        return attempt(async () => {
          const response = await firstValueFrom(api.saveJourney(id, steps));
          patchState(store, { selectedCampaign: response.data });
          return response.data;
        }, 'saving');
      },

      async previewTemplate(
        locale: MarketingLocale,
        template: EmailTemplate,
        variant?: string | null,
      ): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.previewTemplate(locale, template, variant));
          patchState(store, { preview: response.data });
        }, 'loading');
      },

      async searchProducts(term: string): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.searchProducts(term));
          patchState(store, { products: response.data });
        }, 'loading');
      },

      async loadCampaignInsights(id: string): Promise<void> {
        await attempt(async () => {
          const [logs, stats] = await Promise.all([
            firstValueFrom(api.getCampaignLogs(id)),
            firstValueFrom(api.getAbStats(id)),
          ]);
          patchState(store, { stepLogs: logs.data, abStats: stats.data });
        }, 'loading');
      },

      async loadConsents(): Promise<void> {
        await attempt(async () => {
          const [consents, events, strategies] = await Promise.all([
            firstValueFrom(api.getConsents()),
            firstValueFrom(api.getConsentEvents()),
            firstValueFrom(api.getStrategies()),
          ]);
          patchState(store, {
            consents: consents.data,
            consentEvents: events.data,
            strategies: strategies.data,
          });
        }, 'loading');
      },

      async loadConsentEvents(contactId?: string): Promise<void> {
        await attempt(async () => {
          const response = await firstValueFrom(api.getConsentEvents(contactId));
          patchState(store, { consentEvents: response.data });
        }, 'loading');
      },

      async updateConsent(
        contactId: string,
        payload: UpdateConsentPayload,
      ): Promise<MarketingConsent | null> {
        return attempt(async () => {
          const response = await firstValueFrom(api.updateConsent(contactId, payload));
          const saved = response.data;
          const exists = store.consents().some((c) => c.contact_id === contactId);
          patchState(store, {
            consents: exists
              ? store.consents().map((c) => (c.contact_id === contactId ? saved : c))
              : [saved, ...store.consents()],
          });
          const events = await firstValueFrom(api.getConsentEvents(contactId));
          patchState(store, { consentEvents: events.data });
          return saved;
        }, 'saving');
      },
    };
  }),
);
