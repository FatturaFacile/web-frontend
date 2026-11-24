import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  NotificationPreferences,
  NotificationAlertRule,
  NotificationAlertRuleInput,
  NotificationDelivery,
  NotificationDevice,
  NotificationRealtimeConfig,
  NotificationSettings,
  PlatformNotification,
  PlatformResponse,
  RecycleBinRecord,
  RecycleBinType,
  UpdateNotificationPreferencesRequest,
} from '../models/platform.model';

@Service()
export class PlatformApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/platform`;

  // Recycle bin
  getRecycleBinTypes(): Observable<PlatformResponse<RecycleBinType[]>> {
    return this.http.get<PlatformResponse<RecycleBinType[]>>(`${this.base}/recycle-bin/types`);
  }

  getRecycleBin(type: string, page = 1, perPage = 25): Observable<PlatformResponse<RecycleBinRecord[]>> {
    const params = new HttpParams().set('type', type).set('page', String(page)).set('per_page', String(perPage));
    return this.http.get<PlatformResponse<RecycleBinRecord[]>>(`${this.base}/recycle-bin`, { params });
  }

  restoreRecord(type: string, id: string): Observable<PlatformResponse<RecycleBinRecord>> {
    return this.http.post<PlatformResponse<RecycleBinRecord>>(`${this.base}/recycle-bin/${type}/${id}/restore`, {});
  }

  destroyRecord(type: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/recycle-bin/${type}/${id}`);
  }

  // Notification centre
  getNotifications(unreadOnly = false, perPage = 10): Observable<PlatformResponse<PlatformNotification[]>> {
    let params = new HttpParams().set('per_page', String(perPage));
    if (unreadOnly) {
      params = params.set('unread', '1');
    }
    return this.http.get<PlatformResponse<PlatformNotification[]>>(`${this.base}/notifications`, { params });
  }

  markNotificationRead(id: string): Observable<PlatformResponse<PlatformNotification>> {
    return this.http.post<PlatformResponse<PlatformNotification>>(`${this.base}/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<PlatformResponse<{ marked: number }>> {
    return this.http.post<PlatformResponse<{ marked: number }>>(`${this.base}/notifications/read-all`, {});
  }

  deleteNotification(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/notifications/${id}`);
  }

  getNotificationPreferences(): Observable<PlatformResponse<NotificationPreferences>> {
    return this.http.get<PlatformResponse<NotificationPreferences>>(`${this.base}/notifications/preferences`);
  }

  updateNotificationPreferences(body: UpdateNotificationPreferencesRequest): Observable<PlatformResponse<NotificationPreferences>> {
    return this.http.put<PlatformResponse<NotificationPreferences>>(`${this.base}/notifications/preferences`, body);
  }

  getNotificationSettings(): Observable<PlatformResponse<NotificationSettings>> {
    return this.http.get<PlatformResponse<NotificationSettings>>(`${this.base}/notifications/settings`);
  }

  updateNotificationSettings(body: Partial<NotificationSettings>): Observable<PlatformResponse<NotificationSettings>> {
    return this.http.put<PlatformResponse<NotificationSettings>>(`${this.base}/notifications/settings`, body);
  }

  getNotificationRealtime(): Observable<PlatformResponse<NotificationRealtimeConfig>> {
    return this.http.get<PlatformResponse<NotificationRealtimeConfig>>(`${this.base}/notifications/realtime`);
  }

  getNotificationDeliveries(status?: string, page = 1): Observable<PlatformResponse<NotificationDelivery[]>> {
    let params = new HttpParams().set('page', page);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<PlatformResponse<NotificationDelivery[]>>(`${this.base}/notifications/deliveries`, { params });
  }

  getNotificationDevices(): Observable<PlatformResponse<NotificationDevice[]>> {
    return this.http.get<PlatformResponse<NotificationDevice[]>>(`${this.base}/notifications/devices`);
  }

  deleteNotificationDevice(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/notifications/devices/${id}`);
  }

  linkTelegram(): Observable<PlatformResponse<{ url: string }>> {
    return this.http.post<PlatformResponse<{ url: string }>>(`${this.base}/notifications/channels/telegram/link`, {});
  }

  unlinkTelegram(): Observable<void> {
    return this.http.delete<void>(`${this.base}/notifications/channels/telegram`);
  }

  getAlertRules(): Observable<{ data: NotificationAlertRule[]; metrics: string[] }> {
    return this.http.get<{ data: NotificationAlertRule[]; metrics: string[] }>(`${this.base}/notification-alert-rules`);
  }

  createAlertRule(body: NotificationAlertRuleInput): Observable<PlatformResponse<NotificationAlertRule>> {
    return this.http.post<PlatformResponse<NotificationAlertRule>>(`${this.base}/notification-alert-rules`, body);
  }

  updateAlertRule(id: string, body: NotificationAlertRuleInput): Observable<PlatformResponse<NotificationAlertRule>> {
    return this.http.put<PlatformResponse<NotificationAlertRule>>(`${this.base}/notification-alert-rules/${id}`, body);
  }

  deleteAlertRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/notification-alert-rules/${id}`);
  }
}
