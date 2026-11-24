import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiKeyItem,
  ApiResponse,
  CreateApiKeyRequest,
  CreateEcommerceChannelRequest,
  CreatePaymentLinkRequest,
  EcommerceChannel,
  PaymentGatewaySettings,
  PaginatedResponse,
  PaymentLink,
  QueryFilterParams,
  RotateApiKeyResult,
  SyncChannelRequest,
  SyncChannelResult,
  UpdateEcommerceChannelRequest,
  UpdatePaymentGatewayRequest,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Query of the payment link grid: the invoice filter plus the standard paging parameters. */
export interface PaymentLinkListParams extends QueryFilterParams {
  invoice_id?: string;
}

@Service()
export class EcommerceIntegrationsApiService {
  private readonly http = inject(HttpClient);
  private readonly ecomBase = `${environment.apiBaseUrl}/ecommerce`;
  private readonly integBase = `${environment.apiBaseUrl}/integrations`;
  private readonly linksBase = `${environment.apiBaseUrl}/payment-links`;

  // Channels
  getChannels(params?: QueryFilterParams): Observable<PaginatedResponse<EcommerceChannel>> {
    return this.http.get<PaginatedResponse<EcommerceChannel>>(`${this.ecomBase}/channels`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getChannel(id: string): Observable<ApiResponse<EcommerceChannel>> {
    return this.http.get<ApiResponse<EcommerceChannel>>(`${this.ecomBase}/channels/${id}`);
  }

  createChannel(req: CreateEcommerceChannelRequest): Observable<ApiResponse<EcommerceChannel>> {
    return this.http.post<ApiResponse<EcommerceChannel>>(`${this.ecomBase}/channels`, req);
  }

  updateChannel(id: string, req: UpdateEcommerceChannelRequest): Observable<ApiResponse<EcommerceChannel>> {
    return this.http.put<ApiResponse<EcommerceChannel>>(`${this.ecomBase}/channels/${id}`, req);
  }

  deleteChannel(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.ecomBase}/channels/${id}`);
  }

  testConnection(id: string): Observable<ApiResponse<{ success: boolean; message: string }>> {
    return this.http.post<ApiResponse<{ success: boolean; message: string }>>(
      `${this.ecomBase}/channels/${id}/test-connection`,
      {},
    );
  }

  syncChannel(id: string, req?: SyncChannelRequest): Observable<ApiResponse<SyncChannelResult>> {
    return this.http.post<ApiResponse<SyncChannelResult>>(`${this.ecomBase}/channels/${id}/sync`, req || {});
  }

  // Developer API Keys
  getApiKeys(params?: QueryFilterParams): Observable<PaginatedResponse<ApiKeyItem>> {
    return this.http.get<PaginatedResponse<ApiKeyItem>>(`${this.integBase}/api-keys`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createApiKey(req: CreateApiKeyRequest): Observable<ApiResponse<ApiKeyItem>> {
    return this.http.post<ApiResponse<ApiKeyItem>>(`${this.integBase}/api-keys`, req);
  }

  revokeApiKey(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.integBase}/api-keys/${id}`);
  }

  rotateApiKey(id: string): Observable<ApiResponse<RotateApiKeyResult>> {
    return this.http.post<ApiResponse<RotateApiKeyResult>>(`${this.integBase}/api-keys/${id}/rotate`, {});
  }

  // Payment Gateway
  getPaymentGateway(): Observable<ApiResponse<PaymentGatewaySettings>> {
    return this.http.get<ApiResponse<PaymentGatewaySettings>>(`${this.integBase}/payment-gateway`);
  }

  updatePaymentGateway(req: UpdatePaymentGatewayRequest): Observable<ApiResponse<PaymentGatewaySettings>> {
    return this.http.put<ApiResponse<PaymentGatewaySettings>>(`${this.integBase}/payment-gateway`, req);
  }

  // Hosted Payment Links
  getPaymentLinks(params?: PaymentLinkListParams): Observable<PaginatedResponse<PaymentLink>> {
    return this.http.get<PaginatedResponse<PaymentLink>>(this.linksBase, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createPaymentLink(req: CreatePaymentLinkRequest): Observable<ApiResponse<PaymentLink>> {
    return this.http.post<ApiResponse<PaymentLink>>(this.linksBase, req);
  }

  getPaymentLink(id: string): Observable<ApiResponse<PaymentLink>> {
    return this.http.get<ApiResponse<PaymentLink>>(`${this.linksBase}/${id}`);
  }

  /** Withdraws an open link so that a new one can be created for the invoice. */
  cancelPaymentLink(id: string): Observable<ApiResponse<PaymentLink>> {
    return this.http.post<ApiResponse<PaymentLink>>(`${this.linksBase}/${id}/cancel`, {});
  }
}
