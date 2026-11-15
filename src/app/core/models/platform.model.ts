/** Platform features: recycle bin and in-app notification centre. Mirrors the API of the Platform module. */

export type NotificationChannel = 'database' | 'mail';
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
}

export interface NotificationPreferences {
  channels: NotificationChannel[];
  categories: NotificationCategory[];
  preferences: NotificationPreference[];
}

/** Body of PUT /platform/notifications/preferences. */
export interface UpdateNotificationPreferencesRequest {
  preferences: NotificationPreference[];
}
