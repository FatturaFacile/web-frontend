import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AssignTicketRequest,
  ChangeTicketStatusRequest,
  HelpdeskTicketActivityResource,
  HelpdeskTicketMessageResource,
  HelpdeskTicketMessagesResponse,
  ResolveTicketRequest,
  StoreTicketMessageRequest,
  StoreTicketRequest,
  TicketListParams,
  TicketListResponse,
  TicketResource,
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
}
