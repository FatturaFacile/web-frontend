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
  CommunicationCampaign,
  CommunicationCampaignPreview,
  CommunicationCampaignRecipient,
  CommunicationCampaignRequest,
  CommunicationChannelResource,
  CommunicationChannelType,
  CommunicationContactPreference,
  CommunicationContactPreferenceRequest,
  CommunicationConversation,
  CommunicationConversationFilterParams,
  CommunicationConversationMessage,
  CommunicationConversationStatus,
  CommunicationInboundMessageRequest,
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

  getConversations(params?: CommunicationConversationFilterParams): Observable<PaginatedResponse<CommunicationConversation>> {
    return this.http.get<PaginatedResponse<CommunicationConversation>>(`${this.base}/conversations`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getConversation(id: string): Observable<{ data: CommunicationConversation }> {
    return this.http.get<{ data: CommunicationConversation }>(`${this.base}/conversations/${id}`);
  }

  receiveInboundMessage(payload: CommunicationInboundMessageRequest): Observable<{ data: CommunicationConversationMessage }> {
    return this.http.post<{ data: CommunicationConversationMessage }>(`${this.base}/conversations/inbound`, payload);
  }

  replyToConversation(id: string, body: string): Observable<{ data: CommunicationConversationMessage }> {
    return this.http.post<{ data: CommunicationConversationMessage }>(`${this.base}/conversations/${id}/reply`, { body });
  }

  assignConversation(id: string, userId: string | null): Observable<{ data: CommunicationConversation }> {
    return this.http.post<{ data: CommunicationConversation }>(`${this.base}/conversations/${id}/assign`, { user_id: userId });
  }

  changeConversationStatus(id: string, status: CommunicationConversationStatus): Observable<{ data: CommunicationConversation }> {
    return this.http.post<{ data: CommunicationConversation }>(`${this.base}/conversations/${id}/status`, { status });
  }

  markConversationRead(id: string): Observable<{ data: CommunicationConversation }> {
    return this.http.post<{ data: CommunicationConversation }>(`${this.base}/conversations/${id}/read`, {});
  }

  getCampaigns(params?: { status?: string; channel?: string; page?: number; per_page?: number }): Observable<PaginatedResponse<CommunicationCampaign>> {
    return this.http.get<PaginatedResponse<CommunicationCampaign>>(`${this.base}/campaigns`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createCampaign(payload: CommunicationCampaignRequest): Observable<{ data: CommunicationCampaign }> {
    return this.http.post<{ data: CommunicationCampaign }>(`${this.base}/campaigns`, payload);
  }

  updateCampaign(id: string, payload: Partial<CommunicationCampaignRequest>): Observable<{ data: CommunicationCampaign }> {
    return this.http.put<{ data: CommunicationCampaign }>(`${this.base}/campaigns/${id}`, payload);
  }

  deleteCampaign(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/campaigns/${id}`);
  }

  previewCampaign(id: string): Observable<{ data: CommunicationCampaignPreview }> {
    return this.http.get<{ data: CommunicationCampaignPreview }>(`${this.base}/campaigns/${id}/preview`);
  }

  getCampaignRecipients(id: string, status?: string): Observable<PaginatedResponse<CommunicationCampaignRecipient>> {
    return this.http.get<PaginatedResponse<CommunicationCampaignRecipient>>(`${this.base}/campaigns/${id}/recipients`, {
      params: status ? toHttpParams({ status }) : undefined,
    });
  }

  scheduleCampaign(id: string, scheduledAt: string): Observable<{ data: CommunicationCampaign }> {
    return this.http.post<{ data: CommunicationCampaign }>(`${this.base}/campaigns/${id}/schedule`, { scheduled_at: scheduledAt });
  }

  sendCampaign(id: string): Observable<{ data: CommunicationCampaign }> {
    return this.http.post<{ data: CommunicationCampaign }>(`${this.base}/campaigns/${id}/send`, {});
  }

  cancelCampaign(id: string): Observable<{ data: CommunicationCampaign }> {
    return this.http.post<{ data: CommunicationCampaign }>(`${this.base}/campaigns/${id}/cancel`, {});
  }

  getContactPreferences(contactId: string): Observable<{ data: CommunicationContactPreference[] }> {
    return this.http.get<{ data: CommunicationContactPreference[] }>(`${this.base}/contacts/${contactId}/preferences`);
  }

  setContactPreference(contactId: string, payload: CommunicationContactPreferenceRequest): Observable<{ data: CommunicationContactPreference[] }> {
    return this.http.put<{ data: CommunicationContactPreference[] }>(`${this.base}/contacts/${contactId}/preferences`, payload);
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
