import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  CommunicationDeliveryFilterParams,
  CommunicationTemplateFilterParams,
  PaginatedResponse,
  CommunicationChannelResource,
  CommunicationChannelType,
  CommunicationDeliveryLog,
  CommunicationPreviewResponse,
  CommunicationPreviewTemplateRequest,
  CommunicationSaveTemplateRequest,
  CommunicationSendDocumentRequest,
  CommunicationSendMessageRequest,
  CommunicationTemplateResource,
  CommunicationTestChannelRequest,
  CommunicationUpdateChannelRequest,
} from '../models';

@Service()
export class CommunicationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/communication`;

  sendDocument(payload: CommunicationSendDocumentRequest): Observable<ApiResponse<CommunicationDeliveryLog>> {
    return this.http.post<ApiResponse<CommunicationDeliveryLog>>(`${this.base}/documents/send`, payload);
  }

  getDeliveries(params?: CommunicationDeliveryFilterParams): Observable<PaginatedResponse<CommunicationDeliveryLog>> {
    return this.http.get<PaginatedResponse<CommunicationDeliveryLog>>(`${this.base}/deliveries`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDelivery(id: string): Observable<ApiResponse<CommunicationDeliveryLog>> {
    return this.http.get<ApiResponse<CommunicationDeliveryLog>>(`${this.base}/deliveries/${id}`);
  }

  getChannels(): Observable<ApiResponse<CommunicationChannelResource[]>> {
    return this.http.get<ApiResponse<CommunicationChannelResource[]>>(`${this.base}/channels`);
  }

  updateChannel(
    channel: CommunicationChannelType,
    payload: CommunicationUpdateChannelRequest,
  ): Observable<ApiResponse<CommunicationChannelResource>> {
    return this.http.put<ApiResponse<CommunicationChannelResource>>(
      `${this.base}/channels/${channel}`,
      payload,
    );
  }

  testChannel(
    channel: CommunicationChannelType,
    payload: CommunicationTestChannelRequest,
  ): Observable<ApiResponse<{ success: boolean; message?: string }>> {
    return this.http.post<ApiResponse<{ success: boolean; message?: string }>>(
      `${this.base}/channels/${channel}/test`,
      payload,
    );
  }

  sendMessage(payload: CommunicationSendMessageRequest): Observable<ApiResponse<CommunicationDeliveryLog>> {
    return this.http.post<ApiResponse<CommunicationDeliveryLog>>(`${this.base}/messages/send`, payload);
  }

  getTemplates(params?: CommunicationTemplateFilterParams): Observable<PaginatedResponse<CommunicationTemplateResource>> {
    return this.http.get<PaginatedResponse<CommunicationTemplateResource>>(`${this.base}/templates`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getTemplate(id: string): Observable<ApiResponse<CommunicationTemplateResource>> {
    return this.http.get<ApiResponse<CommunicationTemplateResource>>(`${this.base}/templates/${id}`);
  }

  createTemplate(payload: CommunicationSaveTemplateRequest): Observable<ApiResponse<CommunicationTemplateResource>> {
    return this.http.post<ApiResponse<CommunicationTemplateResource>>(`${this.base}/templates`, payload);
  }

  updateTemplate(
    id: string,
    payload: CommunicationSaveTemplateRequest,
  ): Observable<ApiResponse<CommunicationTemplateResource>> {
    return this.http.put<ApiResponse<CommunicationTemplateResource>>(`${this.base}/templates/${id}`, payload);
  }

  deleteTemplate(id: string): Observable<ApiResponse<{ id: string }>> {
    return this.http.delete<ApiResponse<{ id: string }>>(`${this.base}/templates/${id}`);
  }

  previewTemplate(
    id: string,
    payload: CommunicationPreviewTemplateRequest,
  ): Observable<ApiResponse<CommunicationPreviewResponse>> {
    return this.http.post<ApiResponse<CommunicationPreviewResponse>>(
      `${this.base}/templates/${id}/preview`,
      payload,
    );
  }
}
