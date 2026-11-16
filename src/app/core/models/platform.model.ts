/** Platform features: recycle bin and in-app notification centre. Mirrors the API of the Platform module. */

export type NotificationChannel = 'database' | 'mail';
export type NotificationFrequency = 'immediate' | 'digest';
export type NotificationCategory = 'general' | 'billing' | 'crm' | 'inventory' | 'hr' | 'system';

export interface PlatformResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
  unread_count?: number;
}

export interface RecycleBinType {
  type: string;
  count: number;
  purgeable: boolean;
}

export interface RecycleBinRecord {
  id: string;
  type: string;
  label: string;
  deleted_at: string | null;
  purgeable: boolean;
}

export interface PlatformNotification {
  id: string;
  type: string;
  data: { title?: string; message?: string; url?: string; [key: string]: unknown };
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  channel: NotificationChannel;
  category: NotificationCategory;
  enabled: boolean;
  frequency?: NotificationFrequency;
}

export interface NotificationPreferences {
  channels: NotificationChannel[];
  categories: NotificationCategory[];
  frequencies?: NotificationFrequency[];
  preferences: NotificationPreference[];
}

/** Body of PUT /platform/notifications/preferences. */
export interface UpdateNotificationPreferencesRequest {
  preferences: NotificationPreference[];
}

/** Do-not-disturb settings (GET/PUT /platform/notifications/settings). Times are HH:mm in `timezone`. */
export interface NotificationSettings {
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  muted_until: string | null;
}

/** Connection parameters of the WebSocket server (GET /platform/notifications/realtime). */
export interface NotificationRealtimeConfig {
  enabled: boolean;
  key: string | null;
  host: string | null;
  port: number | null;
  scheme: 'http' | 'https' | null;
  channel: string;
  auth_endpoint: string;
}

/** Payload of the `notifications.changed` broadcast event. */
export interface NotificationsChangedEvent {
  unread_count: number;
  notification: PlatformNotification | null;
}
