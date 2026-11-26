export type ScheduledReportLanguage = 'it-CH' | 'de-CH' | 'fr-CH' | 'en' | 'it-IT';

export type ScheduledReportFrequency = 'daily' | 'weekly' | 'monthly' | 'custom_cron';

export type ScheduledReportModuleKey =
  | 'dashboard'
  | 'billing'
  | 'deadlines'
  | 'crm'
  | 'calendar'
  | 'inventory'
  | 'support'
  | 'news'
  | 'insights';

export interface ScheduledNotificationPreference {
  id?: string;
  tenant_id?: string;
  user_id?: string;
  enabled: boolean;
  frequency: ScheduledReportFrequency;
  custom_cron: string | null;
  send_time: string;
  day_of_week: number | null;
  day_of_month: number | null;
  language: ScheduledReportLanguage;
  include_dashboard: boolean;
  include_billing: boolean;
  include_deadlines: boolean;
  include_crm: boolean;
  include_calendar: boolean;
  include_inventory: boolean;
  include_support: boolean;
  include_news: boolean;
  include_insights: boolean;
  last_sent_at?: string | null;
  last_period_key?: string | null;
  unsubscribed_at?: string | null;
}

export interface TenantReportSettings {
  id?: string;
  tenant_id?: string;
  timezone: string;
  default_frequency: ScheduledReportFrequency;
  default_send_time: string;
  sender_name: string | null;
  sender_email: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  custom_header_html: string | null;
  custom_footer_html: string | null;
  enabled_modules: ScheduledReportModuleKey[];
  rate_limit_per_hour: number;
  updated_at?: string | null;
}

export interface ScheduledNotificationPreferencePayload {
  preference: ScheduledNotificationPreference;
  tenant_settings: TenantReportSettings;
  available_modules: ScheduledReportModuleKey[];
  supported_languages: ScheduledReportLanguage[];
  frequencies: ScheduledReportFrequency[];
}

export interface EmailBlacklistEntry {
  id: string;
  tenant_id: string | null;
  is_global: boolean;
  email: string;
  reason: 'unsubscribed' | 'hard_bounce' | 'spam_complaint' | 'manual';
  notes: string | null;
  created_at: string | null;
}

export interface DailySummaryPreviewResponse {
  html: string;
  text: string;
  summary: {
    generated_at: string;
    report_date: string;
    timezone: string;
    currency: string;
    locale: string;
    enabled_modules: ScheduledReportModuleKey[];
    sections: Record<string, unknown>;
  };
}

export interface ScheduledReportDeliveryLog {
  id: string;
  recipient_email: string;
  frequency: string;
  period_key: string;
  language: string;
  is_test: boolean;
  status: 'queued' | 'sent' | 'opened' | 'clicked' | 'failed' | 'generation_failed';
  error_message: string | null;
  queued_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  open_count: number;
  click_count: number;
  created_at: string | null;
}

export interface ScheduledReportAuditLogEntry {
  id: string;
  event_type: string;
  recipient_email: string | null;
  period_key: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string | null;
}

export interface ScheduledReportAuditHistoryResponse {
  deliveries: ScheduledReportDeliveryLog[];
  audit_logs: ScheduledReportAuditLogEntry[];
}

export interface ScheduledReportApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}
