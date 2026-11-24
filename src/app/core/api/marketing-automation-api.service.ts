import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  AbTestStats,
  BlueprintKind,
  CatalogProduct,
  ComplianceStrategyInfo,
  ConsentEvent,
  DynamicCustomerSegment,
  JourneyStep,
  JourneyStepLog,
  MarketingBlueprint,
  MarketingCampaign,
  MarketingConsent,
  MarketingLocale,
  MarketingResponse,
  RfmMatrix,
  RoiDashboard,
  SaveCampaignPayload,
  SaveSegmentPayload,
  SegmentCriteria,
  SegmentPreview,
  TemplatePreview,
  UpdateConsentPayload,
  EmailTemplate,
} from '../models';

/** Mod 155 Marketing Automation API client. */
@Service()
export class MarketingAutomationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/marketing-automation`;

  getDashboard(currency?: string): Observable<MarketingResponse<RoiDashboard>> {
    return this.http.get<MarketingResponse<RoiDashboard>>(`${this.base}/dashboard`, {
      params: toHttpParams({ currency }),
    });
  }

  getBlueprints(kind?: BlueprintKind): Observable<MarketingResponse<MarketingBlueprint[]>> {
    return this.http.get<MarketingResponse<MarketingBlueprint[]>>(`${this.base}/blueprints`, {
      params: toHttpParams({ kind }),
    });
  }

  searchProducts(q: string, limit = 20): Observable<MarketingResponse<CatalogProduct[]>> {
    return this.http.get<MarketingResponse<CatalogProduct[]>>(`${this.base}/catalog/products`, {
      params: toHttpParams({ q, limit }),
    });
  }

  getStrategies(): Observable<MarketingResponse<ComplianceStrategyInfo[]>> {
    return this.http.get<MarketingResponse<ComplianceStrategyInfo[]>>(
      `${this.base}/compliance/strategies`,
    );
  }

  // --- Segments ---

  getSegments(): Observable<MarketingResponse<DynamicCustomerSegment[]>> {
    return this.http.get<MarketingResponse<DynamicCustomerSegment[]>>(`${this.base}/segments`);
  }

  createSegment(
    payload: SaveSegmentPayload,
  ): Observable<MarketingResponse<DynamicCustomerSegment>> {
    return this.http.post<MarketingResponse<DynamicCustomerSegment>>(
      `${this.base}/segments`,
      payload,
    );
  }

  updateSegment(
    id: string,
    payload: Partial<SaveSegmentPayload>,
  ): Observable<MarketingResponse<DynamicCustomerSegment>> {
    return this.http.put<MarketingResponse<DynamicCustomerSegment>>(
      `${this.base}/segments/${id}`,
      payload,
    );
  }

  deleteSegment(id: string): Observable<MarketingResponse<null>> {
    return this.http.delete<MarketingResponse<null>>(`${this.base}/segments/${id}`);
  }

  evaluateSegment(id: string): Observable<MarketingResponse<DynamicCustomerSegment>> {
    return this.http.post<MarketingResponse<DynamicCustomerSegment>>(
      `${this.base}/segments/${id}/evaluate`,
      {},
    );
  }

  previewSegment(criteria: SegmentCriteria): Observable<MarketingResponse<SegmentPreview>> {
    return this.http.post<MarketingResponse<SegmentPreview>>(`${this.base}/segments/preview`, {
      criteria,
    });
  }

  getRfmMatrix(id: string): Observable<MarketingResponse<RfmMatrix>> {
    return this.http.get<MarketingResponse<RfmMatrix>>(`${this.base}/segments/${id}/rfm-matrix`);
  }

  // --- Campaigns ---

  getCampaigns(): Observable<MarketingResponse<MarketingCampaign[]>> {
    return this.http.get<MarketingResponse<MarketingCampaign[]>>(`${this.base}/campaigns`);
  }

  getCampaign(id: string): Observable<MarketingResponse<MarketingCampaign>> {
    return this.http.get<MarketingResponse<MarketingCampaign>>(`${this.base}/campaigns/${id}`);
  }

  createCampaign(payload: SaveCampaignPayload): Observable<MarketingResponse<MarketingCampaign>> {
    return this.http.post<MarketingResponse<MarketingCampaign>>(`${this.base}/campaigns`, payload);
  }

  updateCampaign(
    id: string,
    payload: SaveCampaignPayload,
  ): Observable<MarketingResponse<MarketingCampaign>> {
    return this.http.put<MarketingResponse<MarketingCampaign>>(
      `${this.base}/campaigns/${id}`,
      payload,
    );
  }

  deleteCampaign(id: string): Observable<MarketingResponse<null>> {
    return this.http.delete<MarketingResponse<null>>(`${this.base}/campaigns/${id}`);
  }

  transitionCampaign(
    id: string,
    action: 'activate' | 'schedule' | 'pause' | 'archive',
  ): Observable<MarketingResponse<MarketingCampaign>> {
    return this.http.post<MarketingResponse<MarketingCampaign>>(
      `${this.base}/campaigns/${id}/${action}`,
      {},
    );
  }

  saveJourney(
    id: string,
    steps: JourneyStep[],
  ): Observable<MarketingResponse<MarketingCampaign>> {
    return this.http.put<MarketingResponse<MarketingCampaign>>(
      `${this.base}/campaigns/${id}/journey`,
      {
        steps: steps.map((step) => ({
          step_key: step.step_key,
          type: step.type,
          config: step.config,
          next_step_key: step.next_step_key,
          true_step_key: step.true_step_key,
          false_step_key: step.false_step_key,
          is_entry: step.is_entry,
          pos_x: step.pos_x,
          pos_y: step.pos_y,
        })),
      },
    );
  }

  previewTemplate(
    locale: MarketingLocale,
    template: EmailTemplate,
    variant?: string | null,
  ): Observable<MarketingResponse<TemplatePreview>> {
    return this.http.post<MarketingResponse<TemplatePreview>>(`${this.base}/template-preview`, {
      locale,
      template,
      variant: variant ?? null,
    });
  }

  getCampaignLogs(id: string): Observable<MarketingResponse<JourneyStepLog[]>> {
    return this.http.get<MarketingResponse<JourneyStepLog[]>>(`${this.base}/campaigns/${id}/logs`);
  }

  getAbStats(id: string): Observable<MarketingResponse<AbTestStats>> {
    return this.http.get<MarketingResponse<AbTestStats>>(`${this.base}/campaigns/${id}/ab-stats`);
  }

  // --- Consent & compliance ---

  getConsents(unsubscribed = false): Observable<MarketingResponse<MarketingConsent[]>> {
    return this.http.get<MarketingResponse<MarketingConsent[]>>(`${this.base}/consents`, {
      params: toHttpParams({ unsubscribed: unsubscribed ? 1 : undefined }),
    });
  }

  getConsent(contactId: string): Observable<MarketingResponse<MarketingConsent | null>> {
    return this.http.get<MarketingResponse<MarketingConsent | null>>(
      `${this.base}/consents/${contactId}`,
    );
  }

  updateConsent(
    contactId: string,
    payload: UpdateConsentPayload,
  ): Observable<MarketingResponse<MarketingConsent>> {
    return this.http.put<MarketingResponse<MarketingConsent>>(
      `${this.base}/consents/${contactId}`,
      payload,
    );
  }

  getConsentEvents(contactId?: string): Observable<MarketingResponse<ConsentEvent[]>> {
    return this.http.get<MarketingResponse<ConsentEvent[]>>(`${this.base}/consent-events`, {
      params: toHttpParams({ contact_id: contactId }),
    });
  }
}
