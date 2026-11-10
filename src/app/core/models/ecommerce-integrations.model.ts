export type EcommerceDriver = 'shopify' | 'woocommerce' | 'prestashop' | 'amazon' | 'magento' | 'custom' | string;

export interface EcommerceChannel {
  id: string;
  uuid?: string;
  name: string;
  driver: EcommerceDriver;
  store_url?: string;
  credentials?: Record<string, unknown>;
  settings?: {
    auto_sync_orders?: boolean;
    stock_push_enabled?: boolean;
    price_list_id?: string;
    warehouse_id?: string;
    webhook_secret?: string;
    [key: string]: unknown;
  };
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  last_sync_at?: string | null;
  last_sync_status?: 'success' | 'failed' | 'in_progress' | null;
}

export interface CreateEcommerceChannelRequest {
  name: string;
  driver: string;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UpdateEcommerceChannelRequest {
  name?: string;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  is_active?: boolean;
}

export type SyncEntityType = 'products' | 'orders' | 'stock';

export interface SyncChannelRequest {
  filters?: SyncEntityType[];
}

export interface SyncChannelResult {
  status: 'started' | 'completed' | 'queued' | string;
  synced_items?: number;
  message?: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  token?: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at?: string | null;
  created_at?: string;
  is_revoked?: boolean;
  revoked_at?: string | null;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expires_at?: string | null;
}

export interface RotateApiKeyResult {
  id: string;
  name: string;
  token: string;
  scopes: string[];
  expires_at: string | null;
}

export type PaymentGatewayProvider = 'local' | 'stripe';

export interface PaymentGatewaySettings {
  provider: PaymentGatewayProvider;
  credentials?: {
    secret_key?: string;
    webhook_secret?: string;
    publishable_key?: string;
    [key: string]: unknown;
  } | null;
  is_configured?: boolean;
}

export interface UpdatePaymentGatewayRequest {
  provider: PaymentGatewayProvider;
  credentials?: Record<string, unknown> | null;
}

export interface PaymentLink {
  id: string;
  invoice_id: string;
  url: string;
  /** The API reports `open`, `paid`, `review`, `cancelled` and `failed`. */
  status: 'open' | 'active' | 'paid' | 'review' | 'expired' | 'cancelled' | 'failed' | string;
  amount?: number | string;
  currency?: string;
  expires_at?: string | null;
  created_at?: string;
}

export interface CreatePaymentLinkRequest {
  invoice_id: string;
}
