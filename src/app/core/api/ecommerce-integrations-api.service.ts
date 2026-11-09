import { HttpClient, HttpParams } from '@angular/common/http';
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
  PaymentLink,
  RotateApiKeyResult,
  SyncChannelRequest,
  SyncChannelResult,
  UpdateEcommerceChannelRequest,
  UpdatePaymentGatewayRequest,
} from '../models';

@Service()
export class EcommerceIntegrationsApiService {
  private readonly http = inject(HttpClient);
  private readonly ecomBase = `${environment.apiBaseUrl}/ecommerce`;
  private readonly integBase = `${environment.apiBaseUrl}/integrations`;
  private readonly linksBase = `${environment.apiBaseUrl}/payment-links`;

  // Channels
  getChannels(): Observable<ApiResponse<EcommerceChannel[]>> {
    return this.http.get<ApiResponse<EcommerceChannel[]>>(`${this.ecomBase}/channels`);
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
  getApiKeys(): Observable<ApiResponse<ApiKeyItem[]>> {
    return this.http.get<ApiResponse<ApiKeyItem[]>>(`${this.integBase}/api-keys`);
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
  getPaymentLinks(invoiceId?: string): Observable<ApiResponse<PaymentLink[]>> {
    let params = new HttpParams();
    if (invoiceId) {
      params = params.set('invoice_id', invoiceId);
    }
    return this.http.get<ApiResponse<PaymentLink[]>>(this.linksBase, { params });
  }

  createPaymentLink(req: CreatePaymentLinkRequest): Observable<ApiResponse<PaymentLink>> {
    return this.http.post<ApiResponse<PaymentLink>>(this.linksBase, req);
  }
}
