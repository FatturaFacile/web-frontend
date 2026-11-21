import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../core/http/laravel-http.utils';
import {
  AiProvider,
  AiSettings,
  AiSuggestion,
  AutomationRule,
  Envelope,
  PredictiveDashboard,
  ProviderForm,
  ProviderSetting,
  QueueFilters,
  QueueMeta,
  UsageAudit,
} from './ai-cognitive.models';

/** HTTP access to `/api/v1/ai` (Mod 093: AI Services and Cognitive Automation Layer). */
@Service()
export class AiCognitiveApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/ai`;

  /** The review queue: open items unless a status is asked for. */
  queue(filters: QueueFilters): Observable<Envelope<AiSuggestion[], QueueMeta>> {
    return this.http.get<Envelope<AiSuggestion[], QueueMeta>>(`${this.base}/suggestions`, {
      params: toHttpParams({
        status: filters.status,
        kind: filters.kind,
        priority: filters.priority,
        page: filters.page,
        per_page: filters.perPage,
      }),
    });
  }

  suggestion(id: string): Observable<Envelope<AiSuggestion>> {
    return this.http.get<Envelope<AiSuggestion>>(`${this.base}/suggestions/${id}`);
  }

  /** Approves as proposed, or with the corrected payload (Edit and Approve). */
  approve(
    id: string,
    editedPayload: Record<string, unknown> | null,
    feedback: string | null,
  ): Observable<Envelope<AiSuggestion>> {
    return this.http.post<Envelope<AiSuggestion>>(`${this.base}/suggestions/${id}/approve`, {
      edited_payload: editedPayload,
      feedback,
    });
  }

  reject(id: string, reason: string): Observable<Envelope<AiSuggestion>> {
    return this.http.post<Envelope<AiSuggestion>>(`${this.base}/suggestions/${id}/reject`, {
      reason,
    });
  }

  dashboard(horizonDays?: number | null): Observable<Envelope<PredictiveDashboard>> {
    return this.http.get<Envelope<PredictiveDashboard>>(`${this.base}/insights`, {
      params: toHttpParams({ horizon_days: horizonDays }),
    });
  }

  generateInsights(): Observable<Envelope<Record<string, number>>> {
    return this.http.post<Envelope<Record<string, number>>>(`${this.base}/insights/generate`, {});
  }

  settings(): Observable<Envelope<AiSettings>> {
    return this.http.get<Envelope<AiSettings>>(`${this.base}/settings`);
  }

  saveProvider(provider: AiProvider, form: ProviderForm): Observable<Envelope<ProviderSetting>> {
    return this.http.put<Envelope<ProviderSetting>>(
      `${this.base}/settings/providers/${provider}`,
      form,
    );
  }

  saveRule(rule: AutomationRule): Observable<Envelope<AutomationRule>> {
    return this.http.put<Envelope<AutomationRule>>(`${this.base}/settings/rules/${rule.workflow}`, {
      is_enabled: rule.is_enabled,
      auto_approve_enabled: rule.auto_approve_enabled,
      auto_approve_min_confidence: rule.auto_approve_min_confidence,
      max_auto_amount: rule.max_auto_amount,
      data_classification: rule.data_classification,
      preferred_provider: rule.preferred_provider,
    });
  }

  usageAudit(verifyChain: boolean): Observable<Envelope<UsageAudit>> {
    return this.http.get<Envelope<UsageAudit>>(`${this.base}/usage-audit`, {
      params: toHttpParams({ verify_chain: verifyChain ? 1 : null, per_page: 1 }),
    });
  }
}
