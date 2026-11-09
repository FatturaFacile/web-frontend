import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
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

  getDeliveries(params?: {
    document_id?: string;
    channel?: string;
    status?: string;
    message_type?: string;
    from?: string;
    to?: string;
    per_page?: number;
  }): Observable<ApiResponse<CommunicationDeliveryLog[]>> {
    let httpParams = new HttpParams();
    if (params?.document_id) httpParams = httpParams.set('document_id', params.document_id);
    if (params?.channel) httpParams = httpParams.set('channel', params.channel);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.message_type) httpParams = httpParams.set('message_type', params.message_type);
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());

    return this.http.get<ApiResponse<CommunicationDeliveryLog[]>>(`${this.base}/deliveries`, {
      params: httpParams,
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

  getTemplates(params?: {
    code?: string;
    channel?: string;
    locale?: string;
  }): Observable<ApiResponse<CommunicationTemplateResource[]>> {
    let httpParams = new HttpParams();
    if (params?.code) httpParams = httpParams.set('code', params.code);
    if (params?.channel) httpParams = httpParams.set('channel', params.channel);
    if (params?.locale) httpParams = httpParams.set('locale', params.locale);

    return this.http.get<ApiResponse<CommunicationTemplateResource[]>>(`${this.base}/templates`, {
      params: httpParams,
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
