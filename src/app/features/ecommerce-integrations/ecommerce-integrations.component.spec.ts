import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiKeyItem,
  EcommerceChannel,
  EcommerceIntegrationsApiService,
  PaymentGatewaySettings,
  PaymentLink,
  RotateApiKeyResult,
  SyncChannelResult,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { EcommerceIntegrationsComponent } from './ecommerce-integrations.component';

describe('EcommerceIntegrationsComponent', () => {
  let component: EcommerceIntegrationsComponent;
  let fixture: ComponentFixture<EcommerceIntegrationsComponent>;
  let apiMock: Partial<Record<keyof EcommerceIntegrationsApiService, ReturnType<typeof vi.fn>>>;
  let messageMock: Partial<Record<keyof NzMessageService, ReturnType<typeof vi.fn>>>;

  const mockChannel: EcommerceChannel = {
    id: 'chan-1',
    uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    name: 'Shopify Store',
    driver: 'shopify',
    store_url: 'https://myshop.myshopify.com',
    is_active: true,
    last_sync_at: '2026-11-09T10:00:00Z',
    last_sync_status: 'success',
  };

  const mockApiKey: ApiKeyItem = {
    id: 'key-1',
    name: 'Sync Key',
    scopes: ['reporting.read'],
    expires_at: '2027-12-31T23:59:59Z',
    is_revoked: false,
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

  beforeEach(async () => {
    apiMock = {
      getChannels: vi.fn().mockReturnValue(of({ success: true, data: [mockChannel] })),
      getChannel: vi.fn().mockReturnValue(of({ success: true, data: mockChannel })),
      createChannel: vi.fn().mockReturnValue(of({ success: true, data: mockChannel })),
      updateChannel: vi.fn().mockReturnValue(of({ success: true, data: mockChannel })),
      deleteChannel: vi.fn().mockReturnValue(of({ success: true })),
      testConnection: vi.fn().mockReturnValue(of({ success: true, data: { success: true, message: 'Connected' } })),
      syncChannel: vi.fn().mockReturnValue(
        of({ success: true, data: { status: 'completed', synced_items: 12 } as SyncChannelResult }),
      ),
      getApiKeys: vi.fn().mockReturnValue(of({ success: true, data: [mockApiKey] })),
      createApiKey: vi.fn().mockReturnValue(of({ success: true, data: { ...mockApiKey, token: 'sk_live_token_123' } })),
      revokeApiKey: vi.fn().mockReturnValue(of({ success: true })),
      rotateApiKey: vi.fn().mockReturnValue(
        of({
          success: true,
          data: {
            id: 'key-rotated',
            name: 'Sync Key',
            token: 'sk_live_rotated_456',
            scopes: ['reporting.read'],
            expires_at: null,
          } as RotateApiKeyResult,
        }),
      ),
      getPaymentGateway: vi.fn().mockReturnValue(of({ success: true, data: mockGateway })),
      updatePaymentGateway: vi.fn().mockReturnValue(of({ success: true, data: mockGateway })),
      getPaymentLinks: vi.fn().mockReturnValue(of({ success: true, data: [mockPaymentLink] })),
      createPaymentLink: vi.fn().mockReturnValue(of({ success: true, data: mockPaymentLink })),
      getPaymentLink: vi.fn().mockReturnValue(of({ success: true, data: { ...mockPaymentLink, status: 'paid' } })),
      cancelPaymentLink: vi.fn().mockReturnValue(of({ success: true, data: { ...mockPaymentLink, status: 'cancelled' } })),
    };

    messageMock = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    const translateMock = {
      instant: vi.fn((key: string) => key),
      translate: vi.fn((key: string) => key),
      currentLang: vi.fn().mockReturnValue('en'),
      get: vi.fn().mockReturnValue(of('')),
      onLangChange: of({ lang: 'en' }),
    };

    await TestBed.configureTestingModule({
      imports: [EcommerceIntegrationsComponent],
      providers: [
        { provide: EcommerceIntegrationsApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: messageMock },
        { provide: TranslateService, useValue: translateMock },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EcommerceIntegrationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load channels, api keys, gateway settings, and payment links', () => {
    expect(component).toBeTruthy();
    expect(apiMock['getChannels']).toHaveBeenCalled();
    expect(component.channels().length).toBe(1);
    expect(apiMock['getApiKeys']).toHaveBeenCalled();
    expect(component.apiKeys().length).toBe(1);
    expect(apiMock['getPaymentGateway']).toHaveBeenCalled();
    expect(component.paymentGateway()?.provider).toBe('stripe');
    expect(apiMock['getPaymentLinks']).toHaveBeenCalled();
    expect(component.paymentLinks().length).toBe(1);
  });

  it('should open create channel modal and submit new channel', () => {
    component.openCreateChannelModal();
    expect(component.isChannelModalVisible()).toBe(true);
    expect(component.isEditingChannel()).toBe(false);

    component.channelForm.patchValue({
      name: 'WooCommerce B2B',
      driver: 'woocommerce',
      store_url: 'https://b2b.store.com',
      api_key: 'ck_123',
      api_secret: 'cs_456',
    });

    component.submitChannel();

    expect(apiMock['createChannel']).toHaveBeenCalledWith({
      name: 'WooCommerce B2B',
      driver: 'woocommerce',
      credentials: {
        store_url: 'https://b2b.store.com',
        api_key: 'ck_123',
        api_secret: 'cs_456',
      },
      settings: {
        auto_sync_orders: true,
        stock_push_enabled: true,
      },
    });
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isChannelModalVisible()).toBe(false);
  });

  it('should open edit channel modal and update existing channel', () => {
    component.openEditChannelModal(mockChannel);
    expect(component.isChannelModalVisible()).toBe(true);
    expect(component.isEditingChannel()).toBe(true);
    expect(component.channelForm.value.name).toBe('Shopify Store');

    component.channelForm.patchValue({
      name: 'Shopify Store Updated',
      is_active: false,
    });

    component.submitChannel();

    expect(apiMock['updateChannel']).toHaveBeenCalledWith(
      'chan-1',
      expect.objectContaining({
        name: 'Shopify Store Updated',
        is_active: false,
      }),
    );
    expect(messageMock['success']).toHaveBeenCalled();
  });

  it('should delete channel and test connection', () => {
    component.deleteChannel(mockChannel);
    expect(apiMock['deleteChannel']).toHaveBeenCalledWith('chan-1');
    expect(messageMock['success']).toHaveBeenCalled();

    component.testConnection(mockChannel);
    expect(apiMock['testConnection']).toHaveBeenCalledWith('chan-1');
    expect(messageMock['success']).toHaveBeenCalledWith('Connected');
  });

  it('should open channel details drawer', () => {
    component.openChannelDetails(mockChannel);
    expect(component.selectedChannel()?.id).toBe('chan-1');
    expect(component.isChannelDrawerVisible()).toBe(true);

    component.closeChannelDrawer();
    expect(component.isChannelDrawerVisible()).toBe(false);
    expect(component.selectedChannel()).toBeNull();
  });

  it('should trigger channel synchronization with filters', () => {
    component.openSyncModal(mockChannel);
    expect(component.isSyncModalVisible()).toBe(true);
    expect(component.syncingChannelId()).toBe('chan-1');

    component.syncForm.patchValue({
      sync_products: true,
      sync_orders: false,
      sync_stock: true,
    });

    component.submitSync();

    expect(apiMock['syncChannel']).toHaveBeenCalledWith('chan-1', {
      filters: ['products', 'stock'],
    });
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isSyncModalVisible()).toBe(false);
  });

  it('should create API key and show token reveal modal', () => {
    component.openCreateApiKeyModal();
    expect(component.isApiKeyModalVisible()).toBe(true);

    component.apiKeyForm.patchValue({
      name: 'PowerBI Connector',
      scope_reporting: true,
      expires_at: '2028-01-01',
    });

    component.submitApiKey();

    expect(apiMock['createApiKey']).toHaveBeenCalledWith({
      name: 'PowerBI Connector',
      scopes: ['reporting.read'],
      expires_at: '2028-01-01',
    });
    expect(component.newlyGeneratedToken()).toBe('sk_live_token_123');
    expect(component.isTokenRevealModalVisible()).toBe(true);

    component.closeTokenRevealModal();
    expect(component.isTokenRevealModalVisible()).toBe(false);
    expect(component.newlyGeneratedToken()).toBeNull();
  });

  it('should revoke and rotate API key', () => {
    component.revokeApiKey(mockApiKey);
    expect(apiMock['revokeApiKey']).toHaveBeenCalledWith('key-1');
    expect(messageMock['success']).toHaveBeenCalled();

    component.rotateApiKey(mockApiKey);
    expect(apiMock['rotateApiKey']).toHaveBeenCalledWith('key-1');
    expect(component.newlyGeneratedToken()).toBe('sk_live_rotated_456');
    expect(component.isTokenRevealModalVisible()).toBe(true);
  });

  it('should update payment gateway settings', () => {
    component.gatewayForm.patchValue({
      provider: 'stripe',
      secret_key: 'sk_live_secret_test',
      webhook_secret: 'whsec_secret_test',
      publishable_key: 'pk_live_key_test',
    });

    component.submitPaymentGateway();

    expect(apiMock['updatePaymentGateway']).toHaveBeenCalledWith({
      provider: 'stripe',
      credentials: {
        secret_key: 'sk_live_secret_test',
        webhook_secret: 'whsec_secret_test',
        publishable_key: 'pk_live_key_test',
      },
    });
    expect(messageMock['success']).toHaveBeenCalled();
  });

  it('should create payment link and handle clipboard copy', () => {
    component.openCreatePaymentLinkModal();
    expect(component.isPaymentLinkModalVisible()).toBe(true);

    component.paymentLinkForm.patchValue({ invoice_id: 'inv-456' });
    component.submitCreatePaymentLink();

    expect(apiMock['createPaymentLink']).toHaveBeenCalledWith({ invoice_id: 'inv-456' });
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isPaymentLinkModalVisible()).toBe(false);

    component.copyToClipboard('https://test.link');
    expect(messageMock['success']).toHaveBeenCalled();
  });

  it('should refresh and cancel a payment link in place', () => {
    const link = component.paymentLinks()[0];
    expect(component.isPaymentLinkCancellable(link)).toBe(true);

    component.refreshPaymentLink(link);
    expect(apiMock['getPaymentLink']).toHaveBeenCalledWith('link-1');
    expect(component.paymentLinks()[0].status).toBe('paid');

    component.cancelPaymentLink(link);
    expect(apiMock['cancelPaymentLink']).toHaveBeenCalledWith('link-1');
    expect(component.paymentLinks()[0].status).toBe('cancelled');
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isPaymentLinkCancellable(component.paymentLinks()[0])).toBe(false);
  });

  it('should return correct badge colors', () => {
    expect(component.getDriverBadgeColor('shopify')).toBe('green');
    expect(component.getDriverBadgeColor('woocommerce')).toBe('purple');
    expect(component.getDriverBadgeColor('amazon')).toBe('gold');
    expect(component.getDriverBadgeColor('other')).toBe('cyan');

    expect(component.getLinkStatusBadgeColor('paid')).toBe('success');
    expect(component.getLinkStatusBadgeColor('active')).toBe('processing');
    expect(component.getLinkStatusBadgeColor('expired')).toBe('default');
  });

  it('should handle API errors gracefully', () => {
    apiMock['createChannel']!.mockReturnValue(throwError(() => ({ error: { message: 'Invalid store credentials' } })));
    component.openCreateChannelModal();
    component.channelForm.patchValue({ name: 'Fail Store', driver: 'shopify' });
    component.submitChannel();
    expect(messageMock['error']).toHaveBeenCalledWith('Invalid store credentials');

    apiMock['syncChannel']!.mockReturnValue(throwError(() => ({ error: { message: 'Shop rate limit exceeded' } })));
    component.openSyncModal(mockChannel);
    component.submitSync();
    expect(messageMock['error']).toHaveBeenCalledWith('Shop rate limit exceeded');
  });
});
