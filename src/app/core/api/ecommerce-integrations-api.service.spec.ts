import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiKeyItem,
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
import { EcommerceIntegrationsApiService } from './ecommerce-integrations-api.service';

describe('EcommerceIntegrationsApiService', () => {
  let service: EcommerceIntegrationsApiService;
  let httpMock: HttpTestingController;

  const mockChannel: EcommerceChannel = {
    id: 'chan-1',
    uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    name: 'Shopify Store',
    driver: 'shopify',
    store_url: 'https://myshop.myshopify.com',
    is_active: true,
  };

  const mockApiKey: ApiKeyItem = {
    id: 'key-1',
    name: 'Reporting Sync Key',
    scopes: ['reporting.read'],
    expires_at: '2027-12-31T23:59:59Z',
  };

  const mockGateway: PaymentGatewaySettings = {
    provider: 'stripe',
    is_configured: true,
  };

  const mockPaymentLink: PaymentLink = {
    id: 'link-1',
    invoice_id: 'inv-123',
    url: 'https://pay.fatturafacile.eu/pay/link-1',
    status: 'active',
    amount: 1500,
    currency: 'EUR',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EcommerceIntegrationsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(EcommerceIntegrationsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should list, get, create, update, and delete ecommerce channels', () => {
    service.getChannels().subscribe((res) => {
      expect(res.data).toEqual([mockChannel]);
    });
    const listReq = httpMock.expectOne('/api/v1/ecommerce/channels');
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ success: true, data: [mockChannel] });

    service.getChannel('chan-1').subscribe((res) => {
      expect(res.data).toEqual(mockChannel);
    });
    const getReq = httpMock.expectOne('/api/v1/ecommerce/channels/chan-1');
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ success: true, data: mockChannel });

    const createReqPayload: CreateEcommerceChannelRequest = {
      name: 'Woo Store',
      driver: 'woocommerce',
      credentials: { store_url: 'https://woo.example.com' },
    };
    service.createChannel(createReqPayload).subscribe((res) => {
      expect(res.data).toEqual(mockChannel);
    });
    const createReq = httpMock.expectOne('/api/v1/ecommerce/channels');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ success: true, data: mockChannel });

    const updateReqPayload: UpdateEcommerceChannelRequest = {
      name: 'Updated Store',
      is_active: false,
    };
    service.updateChannel('chan-1', updateReqPayload).subscribe((res) => {
      expect(res.data).toEqual(mockChannel);
    });
    const updateReq = httpMock.expectOne('/api/v1/ecommerce/channels/chan-1');
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({ success: true, data: mockChannel });

    service.deleteChannel('chan-1').subscribe((res) => {
      expect(res.success).toBe(true);
    });
    const deleteReq = httpMock.expectOne('/api/v1/ecommerce/channels/chan-1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true });
  });

  it('should test channel connection and synchronize channel', () => {
    service.testConnection('chan-1').subscribe((res) => {
      expect(res.data?.success).toBe(true);
    });
    const testReq = httpMock.expectOne('/api/v1/ecommerce/channels/chan-1/test-connection');
    expect(testReq.request.method).toBe('POST');
    testReq.flush({ success: true, data: { success: true, message: 'Connected' } });

    const syncPayload: SyncChannelRequest = {
      filters: ['orders', 'stock'],
    };
    const syncRes: SyncChannelResult = {
      status: 'completed',
      synced_items: 42,
    };
    service.syncChannel('chan-1', syncPayload).subscribe((res) => {
      expect(res.data).toEqual(syncRes);
    });
    const syncReq = httpMock.expectOne('/api/v1/ecommerce/channels/chan-1/sync');
    expect(syncReq.request.method).toBe('POST');
    expect(syncReq.request.body).toEqual(syncPayload);
    syncReq.flush({ success: true, data: syncRes });
  });

  it('should handle API keys list, create, revoke, and rotate', () => {
    service.getApiKeys().subscribe((res) => {
      expect(res.data).toEqual([mockApiKey]);
    });
    const keysReq = httpMock.expectOne('/api/v1/integrations/api-keys');
    expect(keysReq.request.method).toBe('GET');
    keysReq.flush({ success: true, data: [mockApiKey] });

    const createKeyPayload: CreateApiKeyRequest = {
      name: 'Sync Key',
      scopes: ['reporting.read'],
    };
    service.createApiKey(createKeyPayload).subscribe((res) => {
      expect(res.data).toEqual(mockApiKey);
    });
    const createReq = httpMock.expectOne('/api/v1/integrations/api-keys');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ success: true, data: mockApiKey });

    service.revokeApiKey('key-1').subscribe((res) => {
      expect(res.success).toBe(true);
    });
    const revokeReq = httpMock.expectOne('/api/v1/integrations/api-keys/key-1');
    expect(revokeReq.request.method).toBe('DELETE');
    revokeReq.flush({ success: true });

    const rotateRes: RotateApiKeyResult = {
      id: 'key-2',
      name: 'Sync Key',
      token: 'sk_live_new_token_123',
      scopes: ['reporting.read'],
      expires_at: null,
    };
    service.rotateApiKey('key-1').subscribe((res) => {
      expect(res.data).toEqual(rotateRes);
    });
    const rotateReq = httpMock.expectOne('/api/v1/integrations/api-keys/key-1/rotate');
    expect(rotateReq.request.method).toBe('POST');
    rotateReq.flush({ success: true, data: rotateRes });
  });

  it('should handle payment gateway and payment links', () => {
    service.getPaymentGateway().subscribe((res) => {
      expect(res.data).toEqual(mockGateway);
    });
    const gwReq = httpMock.expectOne('/api/v1/integrations/payment-gateway');
    expect(gwReq.request.method).toBe('GET');
    gwReq.flush({ success: true, data: mockGateway });

    const updateGwPayload: UpdatePaymentGatewayRequest = {
      provider: 'stripe',
      credentials: { secret_key: 'sk_test_123', webhook_secret: 'whsec_456' },
    };
    service.updatePaymentGateway(updateGwPayload).subscribe((res) => {
      expect(res.data).toEqual(mockGateway);
    });
    const putGwReq = httpMock.expectOne('/api/v1/integrations/payment-gateway');
    expect(putGwReq.request.method).toBe('PUT');
    putGwReq.flush({ success: true, data: mockGateway });

    service.getPaymentLinks('inv-123').subscribe((res) => {
      expect(res.data).toEqual([mockPaymentLink]);
    });
    const linksReq = httpMock.expectOne(
      (req) => req.url === '/api/v1/payment-links' && req.params.get('invoice_id') === 'inv-123',
    );
    expect(linksReq.request.method).toBe('GET');
    linksReq.flush({ success: true, data: [mockPaymentLink] });

    const createLinkPayload: CreatePaymentLinkRequest = { invoice_id: 'inv-123' };
    service.createPaymentLink(createLinkPayload).subscribe((res) => {
      expect(res.data).toEqual(mockPaymentLink);
    });
    const postLinkReq = httpMock.expectOne('/api/v1/payment-links');
    expect(postLinkReq.request.method).toBe('POST');
    postLinkReq.flush({ success: true, data: mockPaymentLink });
  });

  it('reads one payment link by id', () => {
    service.getPaymentLink('link-1').subscribe((res) => {
      expect(res.data).toEqual(mockPaymentLink);
    });
    const req = httpMock.expectOne('/api/v1/payment-links/link-1');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockPaymentLink });
  });

  it('cancels an open payment link', () => {
    service.cancelPaymentLink('link-1').subscribe((res) => {
      expect(res.data.status).toBe('cancelled');
    });
    const req = httpMock.expectOne('/api/v1/payment-links/link-1/cancel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ success: true, data: { ...mockPaymentLink, status: 'cancelled' } });
  });
});
