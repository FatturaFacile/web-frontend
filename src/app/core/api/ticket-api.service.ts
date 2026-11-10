import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AssignTicketRequest,
  AutoAssignRequest,
  BulkTicketRequest,
  BulkTicketResponse,
  ChangeTicketStatusRequest,
  HelpdeskTicketActivityResource,
  HelpdeskTicketMessageResource,
  HelpdeskTicketMessagesResponse,
  KnowledgeArticle,
  MergeTicketRequest,
  RenderedCannedResponse,
  ResolveTicketRequest,
  SplitTicketRequest,
  StoreTicketMessageRequest,
  StoreTicketRequest,
  TicketListParams,
  TicketListResponse,
  TicketReadState,
  TicketResource,
  TicketWatcher,
  UpdateHelpdeskTicketRequest,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class TicketApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/esm/tickets`;

  getTickets(params?: TicketListParams): Observable<TicketListResponse> {
    return this.http.get<TicketListResponse>(this.base, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getTicket(id: string): Observable<ApiResponse<TicketResource>> {
    return this.http.get<ApiResponse<TicketResource>>(`${this.base}/${id}`);
  }

  createTicket(payload: StoreTicketRequest): Observable<ApiResponse<TicketResource>> {
    return this.http.post<ApiResponse<TicketResource>>(this.base, payload);
  }

  updateTicket(id: string, payload: UpdateHelpdeskTicketRequest): Observable<ApiResponse<TicketResource>> {
    return this.http.patch<ApiResponse<TicketResource>>(`${this.base}/${id}`, payload);
  }

  changeTicketStatus(id: string, payload: ChangeTicketStatusRequest): Observable<ApiResponse<TicketResource>> {
    return this.http.post<ApiResponse<TicketResource>>(`${this.base}/${id}/status`, payload);
  }

  assignTicket(id: string, payload: AssignTicketRequest): Observable<ApiResponse<TicketResource>> {
    return this.http.post<ApiResponse<TicketResource>>(`${this.base}/${id}/assign`, payload);
  }

  resolveTicket(id: string, payload: ResolveTicketRequest): Observable<ApiResponse<TicketResource>> {
    return this.http.post<ApiResponse<TicketResource>>(`${this.base}/${id}/resolve`, payload);
  }

  closeTicket(id: string): Observable<ApiResponse<TicketResource>> {
    return this.http.post<ApiResponse<TicketResource>>(`${this.base}/${id}/close`, {});
  }

  reopenTicket(id: string): Observable<ApiResponse<TicketResource>> {
    return this.http.post<ApiResponse<TicketResource>>(`${this.base}/${id}/reopen`, {});
  }

  getTicketMessages(id: string): Observable<HelpdeskTicketMessagesResponse> {
    return this.http.get<HelpdeskTicketMessagesResponse>(`${this.base}/${id}/messages`);
  }

  addTicketMessage(
    id: string,
    payload: StoreTicketMessageRequest,
  ): Observable<ApiResponse<HelpdeskTicketMessageResource>> {
    const formData = new FormData();
    formData.append('body', payload.body);
    if (payload.visibility) {
      formData.append('visibility', payload.visibility);
    }
    if (payload.status) {
      formData.append('status', payload.status);
    }
    if (payload.attachments && payload.attachments.length > 0) {
      payload.attachments.forEach((file) => {
        formData.append('attachments[]', file, file.name);
      });
    }

    return this.http.post<ApiResponse<HelpdeskTicketMessageResource>>(
      `${this.base}/${id}/messages`,
      formData,
    );
  }

  getTicketActivities(id: string): Observable<ApiResponse<HelpdeskTicketActivityResource[]>> {
    return this.http.get<ApiResponse<HelpdeskTicketActivityResource[]>>(`${this.base}/${id}/activities`);
  }

  bulkUpdate(payload: BulkTicketRequest): Observable<BulkTicketResponse> {
    return this.http.post<BulkTicketResponse>(`${this.base}/bulk`, payload);
  }

  mergeTicket(id: string, payload: MergeTicketRequest): Observable<{ data: TicketResource }> {
    return this.http.post<{ data: TicketResource }>(`${this.base}/${id}/merge`, payload);
  }

  splitTicket(id: string, payload: SplitTicketRequest): Observable<{ data: TicketResource }> {
    return this.http.post<{ data: TicketResource }>(`${this.base}/${id}/split`, payload);
  }

  autoAssignTicket(id: string, payload: AutoAssignRequest): Observable<{ data: TicketResource }> {
    return this.http.post<{ data: TicketResource }>(`${this.base}/${id}/auto-assign`, payload);
  }

  getWatchers(id: string): Observable<{ data: TicketWatcher[] }> {
    return this.http.get<{ data: TicketWatcher[] }>(`${this.base}/${id}/watchers`);
  }

  addWatcher(id: string, userId: string): Observable<{ data: TicketWatcher }> {
    return this.http.post<{ data: TicketWatcher }>(`${this.base}/${id}/watchers`, { user_id: userId });
  }

  removeWatcher(id: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/watchers/${userId}`);
  }

  markRead(id: string): Observable<{ data: TicketReadState }> {
    return this.http.post<{ data: TicketReadState }>(`${this.base}/${id}/read`, {});
  }

  downloadAttachment(id: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  renderCannedResponse(id: string, cannedResponseId: string): Observable<{ data: RenderedCannedResponse }> {
    return this.http.post<{ data: RenderedCannedResponse }>(
      `${this.base}/${id}/canned-responses/${cannedResponseId}/render`,
      {},
    );
  }

  applyMacro(id: string, macroId: string): Observable<{ data: TicketResource }> {
    return this.http.post<{ data: TicketResource }>(`${this.base}/${id}/macros/${macroId}/apply`, {});
  }

  getKnowledgeLinks(id: string): Observable<{ data: KnowledgeArticle[] }> {
    return this.http.get<{ data: KnowledgeArticle[] }>(`${this.base}/${id}/knowledge-links`);
  }

  linkKnowledgeArticle(id: string, articleId: string): Observable<{ data: KnowledgeArticle }> {
    return this.http.post<{ data: KnowledgeArticle }>(`${this.base}/${id}/knowledge-links`, {
      article_id: articleId,
    });
  }

  unlinkKnowledgeArticle(id: string, articleId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/knowledge-links/${articleId}`);
  }
}
