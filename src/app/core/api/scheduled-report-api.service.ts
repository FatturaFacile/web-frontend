import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  DailySummaryPreviewResponse,
  EmailBlacklistEntry,
  ScheduledNotificationPreference,
  ScheduledNotificationPreferencePayload,
  ScheduledReportApiEnvelope,
  ScheduledReportAuditHistoryResponse,
  TenantReportSettings,
} from '../models/scheduled-report.model';

@Injectable({ providedIn: 'root' })
export class ScheduledReportApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getPreferences(): Observable<ScheduledReportApiEnvelope<ScheduledNotificationPreferencePayload>> {
    return this.http.get<ScheduledReportApiEnvelope<ScheduledNotificationPreferencePayload>>(
      `${this.base}/notification-preferences`,
    );
  }

  updatePreferences(
    payload: Omit<
      ScheduledNotificationPreference,
      'id' | 'tenant_id' | 'user_id' | 'last_sent_at' | 'last_period_key' | 'unsubscribed_at'
    >,
  ): Observable<ScheduledReportApiEnvelope<ScheduledNotificationPreference>> {
    return this.http.put<ScheduledReportApiEnvelope<ScheduledNotificationPreference>>(
      `${this.base}/notification-preferences`,
      payload,
    );
  }

  getTenantSettings(): Observable<ScheduledReportApiEnvelope<TenantReportSettings>> {
    return this.http.get<ScheduledReportApiEnvelope<TenantReportSettings>>(
      `${this.base}/tenant-report-settings`,
    );
  }

  updateTenantSettings(
    payload: Omit<TenantReportSettings, 'id' | 'tenant_id' | 'updated_at'>,
  ): Observable<ScheduledReportApiEnvelope<TenantReportSettings>> {
    return this.http.put<ScheduledReportApiEnvelope<TenantReportSettings>>(
      `${this.base}/tenant-report-settings`,
      payload,
    );
  }

  getBlacklist(): Observable<ScheduledReportApiEnvelope<EmailBlacklistEntry[]>> {
    return this.http.get<ScheduledReportApiEnvelope<EmailBlacklistEntry[]>>(
      `${this.base}/email-blacklist`,
    );
  }

  addBlacklistEntry(payload: {
    email: string;
    reason: EmailBlacklistEntry['reason'];
    notes?: string | null;
  }): Observable<ScheduledReportApiEnvelope<EmailBlacklistEntry>> {
    return this.http.post<ScheduledReportApiEnvelope<EmailBlacklistEntry>>(
      `${this.base}/email-blacklist`,
      payload,
    );
  }

  deleteBlacklistEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/email-blacklist/${id}`);
  }

  getPreview(overrides?: {
    language?: string;
    include_dashboard?: boolean;
    include_billing?: boolean;
    include_deadlines?: boolean;
    include_crm?: boolean;
    include_calendar?: boolean;
    include_inventory?: boolean;
    include_support?: boolean;
    include_news?: boolean;
    include_insights?: boolean;
  }): Observable<ScheduledReportApiEnvelope<DailySummaryPreviewResponse>> {
    let params = new HttpParams();
    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        if (value !== undefined) {
          params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        }
      }
    }

    return this.http.get<ScheduledReportApiEnvelope<DailySummaryPreviewResponse>>(
      `${this.base}/reports/daily-summary/preview`,
      { params },
    );
  }

  sendTest(): Observable<
    ScheduledReportApiEnvelope<{ queued: boolean; recipient_email: string; is_test: boolean }>
  > {
    return this.http.post<
      ScheduledReportApiEnvelope<{ queued: boolean; recipient_email: string; is_test: boolean }>
    >(`${this.base}/reports/daily-summary/send-test`, {});
  }

  sendNow(
    userId?: string,
  ): Observable<
    ScheduledReportApiEnvelope<{ queued: boolean; recipient_email: string; is_test: boolean }>
  > {
    return this.http.post<
      ScheduledReportApiEnvelope<{ queued: boolean; recipient_email: string; is_test: boolean }>
    >(`${this.base}/reports/daily-summary/send-now`, userId ? { user_id: userId } : {});
  }

  getAuditLogs(): Observable<ScheduledReportApiEnvelope<ScheduledReportAuditHistoryResponse>> {
    return this.http.get<ScheduledReportApiEnvelope<ScheduledReportAuditHistoryResponse>>(
      `${this.base}/reports/daily-summary/audit-logs`,
    );
  }
}
