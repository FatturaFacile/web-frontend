/** Contracts of the self-service customer portal (`/api/v1/portal/*`, bearer session of one customer). */

export interface PortalEnvelope<T> {
  readonly success: boolean;
  readonly message: string;
  readonly data: T;
  readonly meta?: PortalPageMeta;
}

export interface PortalPageMeta {
  readonly current_page: number;
  readonly last_page: number;
  readonly per_page: number;
  readonly total: number;
}

/** White-label theme of a tenant, public and read before sign-in. */
export interface PortalBranding {
  readonly company_name: string | null;
  readonly portal_slug: string | null;
  readonly logo_url: string | null;
  readonly favicon_url: string | null;
  readonly primary_color: string | null;
  readonly secondary_color: string | null;
  readonly support_email: string | null;
  readonly privacy_policy_url: string | null;
  /** Country of the tenant (`CH`, `IT`, ...): drives the payment methods offered. */
  readonly region: string | null;
}

export interface PortalCustomer {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly country?: string | null;
}

export type PortalVerifyResult =
  | { readonly status: 'otp_required' }
  | {
      readonly status: 'authenticated';
      readonly token: string;
      readonly token_type: 'Bearer';
      readonly abilities: readonly string[];
      readonly expires_at: string;
      readonly customer: PortalCustomer;
    };

export interface PortalVerifyPayload {
  readonly token: string;
  readonly otp?: string;
  readonly accept_privacy?: boolean;
}

export interface PortalMoney {
  readonly currency: string;
  readonly amount: string;
}

export interface PortalDashboard {
  readonly customer: PortalCustomer;
  readonly session_expires_at: string;
  readonly open_balance: readonly PortalMoney[];
  readonly open_invoices: number;
  readonly overdue_invoices: number;
  readonly pending_quotes: readonly PortalPendingQuote[];
  readonly recent_shipments: readonly PortalDeliveryNote[];
}

export interface PortalPendingQuote {
  readonly id: string;
  readonly quote_number: string;
  readonly date: string | null;
  readonly total_gross: number;
  readonly currency: string;
}

export type PortalPaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface PortalInvoice {
  readonly id: string;
  readonly invoice_number: string;
  readonly date: string | null;
  readonly due_date: string | null;
  readonly currency: string;
  readonly total_gross: number;
  readonly total_paid: number;
  readonly payment_status: PortalPaymentStatus;
  readonly is_paid: boolean;
}

export interface PortalQuote {
  readonly id: string;
  readonly quote_number: string;
  readonly date: string | null;
  readonly valid_until?: string | null;
  readonly currency: string;
  readonly total_gross: number;
  readonly status: string;
}

export interface PortalShipment {
  readonly carrier_name: string | null;
  readonly tracking_number: string | null;
  readonly tracking_url: string | null;
}

export interface PortalDeliveryNote {
  readonly id: string;
  readonly ddt_number: string;
  readonly sales_order_id: string | null;
  readonly date: string | null;
  readonly packages_count: number | null;
  readonly shipping_status: string | null;
  readonly shipped_at: string | null;
  readonly delivered_at: string | null;
  readonly shipment: PortalShipment;
}

export interface PortalOrder {
  readonly id: string;
  readonly order_number: string;
  readonly date: string | null;
  readonly currency: string;
  readonly total_gross: number;
  readonly status: string;
  readonly shipments?: readonly PortalDeliveryNote[];
}

export interface PortalQuoteApprovalPayload {
  readonly signer_name: string;
  readonly notes?: string;
}

export interface PortalCheckout {
  readonly invoice_id: string;
  readonly provider: string;
  readonly amount: string;
  readonly currency: string;
  readonly url: string;
}

export type PortalTicketKind = 'inquiry' | 'invoice_dispute' | 'defective_goods';

export interface PortalTicketPayload {
  readonly kind: PortalTicketKind;
  readonly subject: string;
  readonly description: string;
  readonly invoice_id?: string;
  readonly order_id?: string;
  readonly ddt_id?: string;
  readonly attachments?: readonly File[];
}

export interface PortalTicket {
  readonly id: string;
  readonly ticket_number: string;
  readonly subject: string;
  readonly status: string;
  readonly priority: string;
  readonly created_at: string | null;
}

/** Payment methods the checkout offers for a region; the hosted page of the tenant's gateway completes them. */
export type PortalPaymentMethod = 'card' | 'twint' | 'qr_transfer' | 'sepa_debit' | 'paypal';
