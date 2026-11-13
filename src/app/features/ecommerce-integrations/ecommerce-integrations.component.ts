import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
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
import { MoneyPipe, PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { inFuture } from '@shared/utils/date-validators';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-ecommerce-integrations',
  styleUrl: './ecommerce-integrations.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
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
    NzPopconfirmModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
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
    name: ['', [Validators.required, Validators.maxLength(100)]],
    driver: ['shopify', [Validators.required]],
    store_url: ['', [Validators.maxLength(255), this.storeUrlValidator()]],
    api_key: ['', [Validators.maxLength(500), this.driverCredentialValidator(['woocommerce', 'prestashop'])]],
    api_secret: ['', [Validators.maxLength(500), this.driverCredentialValidator(['woocommerce', 'shopify'])]],
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
    name: ['', [Validators.required, Validators.maxLength(100)]],
    scope_reporting: [true, [Validators.requiredTrue]],
    expires_at: ['', [inFuture]],
  });

  readonly gatewayForm: FormGroup = this.fb.group({
    provider: ['stripe' as PaymentGatewayProvider, [Validators.required]],
    secret_key: ['', [Validators.maxLength(255)]],
    webhook_secret: ['', [Validators.maxLength(255)]],
    publishable_key: [''],
  });

  readonly paymentLinkForm: FormGroup = this.fb.group({
    invoice_id: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
  });

  constructor() {
    this.channelForm
      .get('driver')!
      .valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.revalidateChannelCredentials());
  }

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

  /**
   * Mirrors the credential rules of StoreEcommerceChannelRequest: WooCommerce needs the store URL, key and secret,
   * Shopify the shop domain and the access token (secret field), PrestaShop the store URL and the key. When editing,
   * the stored credentials are kept, so the secrets may stay empty (the store URL of WooCommerce/PrestaShop is
   * prefilled and cannot be cleared).
   */
  private driverCredentialValidator(drivers: readonly string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const driver = control.parent?.get('driver')?.value as string | undefined;
      if (this.isEditingChannel() || !driver || !drivers.includes(driver)) {
        return null;
      }
      return String(control.value ?? '').trim() === '' ? { required: true } : null;
    };
  }

  private storeUrlValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const driver = control.parent?.get('driver')?.value as string | undefined;
      const value = String(control.value ?? '').trim();
      if (!driver) {
        return null;
      }
      if (value === '') {
        const needed = driver !== 'shopify' || !this.isEditingChannel();
        return needed ? { required: true } : null;
      }
      if (driver === 'shopify') {
        const host = value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(host) ? null : { pattern: true };
      }
      return /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(value) ? null : { pattern: true };
    };
  }

  /** Whether the channel field is mandatory for the chosen driver (drives the required marker of the label). */
  isChannelFieldRequired(field: 'store_url' | 'api_key' | 'api_secret'): boolean {
    const driver = this.channelForm.get('driver')?.value as string;
    if (field === 'store_url') {
      return driver !== 'shopify' || !this.isEditingChannel();
    }
    if (this.isEditingChannel()) {
      return false;
    }
    return field === 'api_key' ? ['woocommerce', 'prestashop'].includes(driver) : ['woocommerce', 'shopify'].includes(driver);
  }

  private revalidateChannelCredentials(): void {
    for (const name of ['store_url', 'api_key', 'api_secret']) {
      this.channelForm.get(name)?.updateValueAndValidity();
    }
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
    this.revalidateChannelCredentials();
    this.isChannelModalVisible.set(true);
  }

  openEditChannelModal(ch: EcommerceChannel): void {
    this.isEditingChannel.set(true);
    this.selectedChannel.set(ch);
    this.channelForm.patchValue({
      name: ch.name,
      driver: ch.driver,
      store_url: ch.api_url || '',
      api_key: '',
      api_secret: '',
      auto_sync_orders: ch.sync_orders_enabled ?? true,
      stock_push_enabled: ch.sync_stock_enabled ?? true,
      is_active: ch.is_active,
    });
    this.revalidateChannelCredentials();
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
    const credentials = this.credentialsOf(val.driver, val.store_url, val.api_key, val.api_secret);
    const apiUrl = val.driver === 'shopify' ? null : val.store_url || null;

    this.loading.set(true);
    if (this.isEditingChannel() && this.selectedChannel()) {
      const updateReq: UpdateEcommerceChannelRequest = {
        name: val.name,
        api_url: apiUrl,
        credentials,
        sync_orders_enabled: val.auto_sync_orders,
        sync_stock_enabled: val.stock_push_enabled,
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
        api_url: apiUrl,
        credentials,
        sync_orders_enabled: val.auto_sync_orders,
        sync_stock_enabled: val.stock_push_enabled,
        is_active: val.is_active,
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

  /** Credentials each driver needs (StoreEcommerceChannelRequest): WooCommerce key and secret, Shopify token and shop domain, PrestaShop key. */
  private credentialsOf(driver: string, storeUrl: string, apiKey: string, apiSecret: string): Record<string, string> {
    const credentials: Record<string, string> = {};
    const set = (key: string, value: string): void => {
      if (value) {
        credentials[key] = value;
      }
    };
    if (driver === 'woocommerce') {
      set('consumer_key', apiKey);
      set('consumer_secret', apiSecret);
    } else if (driver === 'shopify') {
      set('access_token', apiSecret);
      set('shop_domain', storeUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase());
    } else if (driver === 'prestashop') {
      set('api_key', apiKey);
    }
    return credentials;
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

  isPaymentLinkCancellable(link: PaymentLink): boolean {
    return link.status === 'open' || link.status === 'active';
  }

  /** Re-reads one link, for example to see whether the customer has paid it. */
  refreshPaymentLink(link: PaymentLink): void {
    this.api.getPaymentLink(link.id).subscribe({
      next: (res) => this.replacePaymentLink(res.data),
      error: () => this.message.error(this.translate.instant('ECOMMERCE_INTEGRATIONS.PAYMENT_LINKS_LOAD_ERROR')),
    });
  }

  cancelPaymentLink(link: PaymentLink): void {
    this.api.cancelPaymentLink(link.id).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('ECOMMERCE_INTEGRATIONS.PAYMENT_LINK_CANCELLED'));
        this.replacePaymentLink(res.data ?? { ...link, status: 'cancelled' });
      },
      error: (err: unknown) => {
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('ECOMMERCE_INTEGRATIONS.PAYMENT_LINK_CANCEL_FAILED'));
      },
    });
  }

  private replacePaymentLink(updated: PaymentLink): void {
    this.paymentLinks.update((links) => links.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
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
      case 'open':
      case 'active':
        return 'processing';
      case 'review':
        return 'warning';
      case 'failed':
        return 'error';
      case 'expired':
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  }
}
