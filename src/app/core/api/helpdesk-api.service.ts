import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  CannedResponse,
  HelpdeskNotification,
  HelpdeskNotificationsResponse,
  KnowledgeArticle,
  KnowledgeArticleParams,
  Macro,
} from '../models';

/** Agent tools, knowledge base search and notifications of the helpdesk (`/esm/helpdesk`, `/esm/kb`). */
@Service()
export class HelpdeskApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/esm`;

  getCannedResponses(): Observable<{ data: CannedResponse[] }> {
    return this.http.get<{ data: CannedResponse[] }>(`${this.base}/helpdesk/canned-responses`);
  }

  getMacros(): Observable<{ data: Macro[] }> {
    return this.http.get<{ data: Macro[] }>(`${this.base}/helpdesk/macros`);
  }

  getKnowledgeArticles(params?: KnowledgeArticleParams): Observable<{ data: KnowledgeArticle[] }> {
    return this.http.get<{ data: KnowledgeArticle[] }>(`${this.base}/kb/articles`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getNotifications(unreadOnly = false): Observable<HelpdeskNotificationsResponse> {
    return this.http.get<HelpdeskNotificationsResponse>(`${this.base}/helpdesk/notifications`, {
      params: unreadOnly ? toHttpParams({ unread: true }) : undefined,
    });
  }

  markNotificationRead(id: string): Observable<{ data: HelpdeskNotification }> {
    return this.http.post<{ data: HelpdeskNotification }>(`${this.base}/helpdesk/notifications/${id}/read`, {});
  }
}
