import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ApiKeyItem,
  CreateApiKeyRequest,
  CreateEcommerceChannelRequest,
  CreatePaymentLinkRequest,
  EcommerceChannel,
  EcommerceIntegrationsApiService,
  PaymentGatewayProvider,
  PaymentGatewaySettings,
  PaymentLink,
  SyncChannelRequest,
  SyncEntityType,
  TranslateService,
  UpdateEcommerceChannelRequest,
  UpdatePaymentGatewayRequest,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-ecommerce-integrations',
  imports: [
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzBadgeModule,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzDrawerModule,
    NzDescriptionsModule,
    NzAlertModule,
    NzSpinModule,
    NzDividerModule,
    NzSwitchModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './ecommerce-integrations.component.html',
  styleUrls: ['./ecommerce-integrations.component.scss'],
})
export class EcommerceIntegrationsComponent implements OnInit {
  private readonly api = inject(EcommerceIntegrationsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal<boolean>(false);
  readonly selectedTabIndex = signal<number>(0);

  // Channels
  readonly channels = signal<EcommerceChannel[]>([]);
  readonly selectedChannel = signal<EcommerceChannel | null>(null);
  readonly isChannelDrawerVisible = signal<boolean>(false);
  readonly isChannelModalVisible = signal<boolean>(false);
  readonly isEditingChannel = signal<boolean>(false);

  // Synchronization
  readonly isSyncModalVisible = signal<boolean>(false);
  readonly syncingChannelId = signal<string | null>(null);

  // API Keys
  readonly apiKeys = signal<ApiKeyItem[]>([]);
  readonly isApiKeyModalVisible = signal<boolean>(false);
  readonly newlyGeneratedToken = signal<string | null>(null);
  readonly isTokenRevealModalVisible = signal<boolean>(false);

  // Payment Gateway & Links
  readonly paymentGateway = signal<PaymentGatewaySettings | null>(null);
  readonly paymentLinks = signal<PaymentLink[]>([]);
  readonly isPaymentLinkModalVisible = signal<boolean>(false);
  readonly filterInvoiceId = signal<string>('');

  // Forms
  readonly channelForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    driver: ['shopify', [Validators.required]],
    store_url: [''],
    api_key: [''],
    api_secret: [''],
    auto_sync_orders: [true],
    stock_push_enabled: [true],
    is_active: [true],
  });

  readonly syncForm: FormGroup = this.fb.group({
    sync_products: [true],
    sync_orders: [true],
    sync_stock: [true],
  });

  readonly apiKeyForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    scope_reporting: [true],
    expires_at: [''],
  });

  readonly gatewayForm: FormGroup = this.fb.group({
    provider: ['stripe' as PaymentGatewayProvider, [Validators.required]],
    secret_key: [''],
    webhook_secret: [''],
    publishable_key: [''],
  });

  readonly paymentLinkForm: FormGroup = this.fb.group({
    invoice_id: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadChannels();
    this.loadApiKeys();
    this.loadPaymentGateway();
    this.loadPaymentLinks();
  }

  // --- Channels ---
  loadChannels(): void {
    this.loading.set(true);
    this.api.getChannels().subscribe({
      next: (res) => {
        this.channels.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('ECOMMERCE_INTEGRATIONS.CHANNELS_LOAD_ERROR'));
      },
    });
  }

  openCreateChannelModal(): void {
    this.isEditingChannel.set(false);
    this.channelForm.reset({
      name: '',
      driver: 'shopify',
      store_url: '',
      api_key: '',
      api_secret: '',
      auto_sync_orders: true,
      stock_push_enabled: true,
      is_active: true,
    });
    this.isChannelModalVisible.set(true);
  }

  openEditChannelModal(ch: EcommerceChannel): void {
    this.isEditingChannel.set(true);
    this.selectedChannel.set(ch);
    this.channelForm.patchValue({
      name: ch.name,
      driver: ch.driver,
      store_url: ch.store_url || (ch.credentials?.['store_url'] as string) || '',
      api_key: (ch.credentials?.['api_key'] as string) || '',
      api_secret: '',
      auto_sync_orders: ch.settings?.auto_sync_orders ?? true,
      stock_push_enabled: ch.settings?.stock_push_enabled ?? true,
      is_active: ch.is_active,
    });
    this.isChannelModalVisible.set(true);
  }

  closeChannelModal(): void {
    this.isChannelModalVisible.set(false);
    this.selectedChannel.set(null);
  }

  submitChannel(): void {
    if (this.channelForm.invalid) {
      this.channelForm.markAllAsTouched();
      return;
    }

    const val = this.channelForm.value;
    const credentials: Record<string, unknown> = {
      store_url: val.store_url,
    };
    if (val.api_key) {
      credentials['api_key'] = val.api_key;
    }
    if (val.api_secret) {
      credentials['api_secret'] = val.api_secret;
    }

    const settings: Record<string, unknown> = {
      auto_sync_orders: val.auto_sync_orders,
      stock_push_enabled: val.stock_push_enabled,
    };

    this.loading.set(true);
    if (this.isEditingChannel() && this.selectedChannel()) {
      const updateReq: UpdateEcommerceChannelRequest = {
        name: val.name,
        credentials,
        settings,
        is_active: val.is_active,
      };
      this.api.updateChannel(this.selectedChannel()!.id, updateReq).subscribe({
        next: () => {
          this.loading.set(false);
          this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.CHANNEL_UPDATED_SUCCESS'));
          this.closeChannelModal();
          this.loadChannels();
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const errorDetail = (err as { error?: { message?: string } })?.error?.message;
          this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.CHANNEL_UPDATE_FAILED'));
        },
      });
    } else {
      const createReq: CreateEcommerceChannelRequest = {
        name: val.name,
        driver: val.driver,
        credentials,
        settings,
      };
      this.api.createChannel(createReq).subscribe({
        next: () => {
          this.loading.set(false);
          this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.CHANNEL_CREATED_SUCCESS'));
          this.closeChannelModal();
          this.loadChannels();
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const errorDetail = (err as { error?: { message?: string } })?.error?.message;
          this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.CHANNEL_CREATE_FAILED'));
        },
      });
    }
  }

  deleteChannel(ch: EcommerceChannel): void {
    this.loading.set(true);
    this.api.deleteChannel(ch.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.CHANNEL_DELETED_SUCCESS'));
        this.loadChannels();
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('ECOMMERCE_INTEGRATIONS.CHANNEL_DELETE_FAILED'));
      },
    });
  }

  testConnection(ch: EcommerceChannel): void {
    this.loading.set(true);
    this.api.testConnection(ch.id).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.message.success(res.data?.message || this.translate.instant('ECOMMERCE_INTEGRATIONS.CONNECTION_SUCCESS'));
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.CONNECTION_FAILED'));
      },
    });
  }

  openChannelDetails(ch: EcommerceChannel): void {
    this.selectedChannel.set(ch);
    this.isChannelDrawerVisible.set(true);
  }

  closeChannelDrawer(): void {
    this.isChannelDrawerVisible.set(false);
    this.selectedChannel.set(null);
  }

  // --- Synchronization ---
  openSyncModal(ch: EcommerceChannel): void {
    this.syncingChannelId.set(ch.id);
    this.syncForm.reset({
      sync_products: true,
      sync_orders: true,
      sync_stock: true,
    });
    this.isSyncModalVisible.set(true);
  }

  closeSyncModal(): void {
    this.isSyncModalVisible.set(false);
    this.syncingChannelId.set(null);
  }

  submitSync(): void {
    const chId = this.syncingChannelId();
    if (!chId) {
      return;
    }
    const val = this.syncForm.value;
    const filters: SyncEntityType[] = [];
    if (val.sync_products) {
      filters.push('products');
    }
    if (val.sync_orders) {
      filters.push('orders');
    }
    if (val.sync_stock) {
      filters.push('stock');
    }

    const req: SyncChannelRequest = { filters };

    this.loading.set(true);
    this.api.syncChannel(chId, req).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.message.success(res.data?.message || this.translate.instant('ECOMMERCE_INTEGRATIONS.SYNC_STARTED_SUCCESS'));
        this.closeSyncModal();
        this.loadChannels();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.SYNC_FAILED'));
      },
    });
  }

  // --- API Keys ---
  loadApiKeys(): void {
    this.api.getApiKeys().subscribe({
      next: (res) => {
        this.apiKeys.set(res.data ?? []);
      },
      error: () => {
        this.message.error(this.translate.instant('ECOMMERCE_INTEGRATIONS.API_KEYS_LOAD_ERROR'));
      },
    });
  }

  openCreateApiKeyModal(): void {
    this.apiKeyForm.reset({
      name: '',
      scope_reporting: true,
      expires_at: '',
    });
    this.isApiKeyModalVisible.set(true);
  }

  closeApiKeyModal(): void {
    this.isApiKeyModalVisible.set(false);
  }

  submitApiKey(): void {
    if (this.apiKeyForm.invalid) {
      this.apiKeyForm.markAllAsTouched();
      return;
    }
    const val = this.apiKeyForm.value;
    const scopes: string[] = [];
    if (val.scope_reporting) {
      scopes.push('reporting.read');
    }

    const req: CreateApiKeyRequest = {
      name: val.name,
      scopes,
      expires_at: val.expires_at || null,
    };

    this.loading.set(true);
    this.api.createApiKey(req).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.closeApiKeyModal();
        this.loadApiKeys();
        if (res.data?.token) {
          this.newlyGeneratedToken.set(res.data.token);
          this.isTokenRevealModalVisible.set(true);
        } else {
          this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.API_KEY_CREATED_SUCCESS'));
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.API_KEY_CREATE_FAILED'));
      },
    });
  }

  revokeApiKey(key: ApiKeyItem): void {
    this.loading.set(true);
    this.api.revokeApiKey(key.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.API_KEY_REVOKED_SUCCESS'));
        this.loadApiKeys();
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('ECOMMERCE_INTEGRATIONS.API_KEY_REVOKE_FAILED'));
      },
    });
  }

  rotateApiKey(key: ApiKeyItem): void {
    this.loading.set(true);
    this.api.rotateApiKey(key.id).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.loadApiKeys();
        if (res.data?.token) {
          this.newlyGeneratedToken.set(res.data.token);
          this.isTokenRevealModalVisible.set(true);
        } else {
          this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.API_KEY_ROTATED_SUCCESS'));
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.API_KEY_ROTATE_FAILED'));
      },
    });
  }

  closeTokenRevealModal(): void {
    this.isTokenRevealModalVisible.set(false);
    this.newlyGeneratedToken.set(null);
  }

  // --- Payment Gateway ---
  loadPaymentGateway(): void {
    this.api.getPaymentGateway().subscribe({
      next: (res) => {
        if (res.data) {
          this.paymentGateway.set(res.data);
          this.gatewayForm.patchValue({
            provider: res.data.provider,
            publishable_key: (res.data.credentials?.['publishable_key'] as string) || '',
          });
        }
      },
      error: () => undefined,
    });
  }

  submitPaymentGateway(): void {
    if (this.gatewayForm.invalid) {
      this.gatewayForm.markAllAsTouched();
      return;
    }
    const val = this.gatewayForm.value;
    const credentials: Record<string, unknown> = {};
    if (val.secret_key) {
      credentials['secret_key'] = val.secret_key;
    }
    if (val.webhook_secret) {
      credentials['webhook_secret'] = val.webhook_secret;
    }
    if (val.publishable_key) {
      credentials['publishable_key'] = val.publishable_key;
    }

    const req: UpdatePaymentGatewayRequest = {
      provider: val.provider,
      credentials: Object.keys(credentials).length > 0 ? credentials : null,
    };

    this.loading.set(true);
    this.api.updatePaymentGateway(req).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.GATEWAY_UPDATED_SUCCESS'));
        if (res.data) {
          this.paymentGateway.set(res.data);
        }
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.GATEWAY_UPDATE_FAILED'));
      },
    });
  }

  // --- Payment Links ---
  loadPaymentLinks(): void {
    this.loading.set(true);
    this.api.getPaymentLinks(this.filterInvoiceId() || undefined).subscribe({
      next: (res) => {
        this.paymentLinks.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('ECOMMERCE_INTEGRATIONS.PAYMENT_LINKS_LOAD_ERROR'));
      },
    });
  }

  openCreatePaymentLinkModal(): void {
    this.paymentLinkForm.reset({ invoice_id: this.filterInvoiceId() || '' });
    this.isPaymentLinkModalVisible.set(true);
  }

  closePaymentLinkModal(): void {
    this.isPaymentLinkModalVisible.set(false);
  }

  submitCreatePaymentLink(): void {
    if (this.paymentLinkForm.invalid) {
      this.paymentLinkForm.markAllAsTouched();
      return;
    }
    const val = this.paymentLinkForm.value;
    const req: CreatePaymentLinkRequest = {
      invoice_id: val.invoice_id,
    };

    this.loading.set(true);
    this.api.createPaymentLink(req).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.PAYMENT_LINK_CREATED_SUCCESS'));
        this.closePaymentLinkModal();
        this.loadPaymentLinks();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.PAYMENT_LINK_CREATE_FAILED'));
      },
    });
  }

  copyToClipboard(text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.COPIED_TO_CLIPBOARD'));
      });
    }
  }

  getDriverBadgeColor(driver: string): string {
    switch (driver?.toLowerCase()) {
      case 'shopify':
        return 'green';
      case 'woocommerce':
        return 'purple';
      case 'amazon':
        return 'gold';
      case 'prestashop':
        return 'blue';
      default:
        return 'cyan';
    }
  }

  getLinkStatusBadgeColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'success';
      case 'active':
        return 'processing';
      case 'expired':
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  }
}
