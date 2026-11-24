/** Mod 046: dispatch, supplier confirmations, overdue reminders, dropshipment and pricing preview. */

/** Decimals arrive from the API as strings. */
export type DecimalString = string;

export const DISPATCH_CHANNELS = ['pdf', 'email', 'edi', 'peppol'] as const;
export type DispatchChannel = (typeof DISPATCH_CHANNELS)[number];

export interface PurchaseOrderDispatch {
  id: string;
  purchase_order_id: string;
  channel: DispatchChannel;
  status: string;
  recipient: string | null;
  message_reference: string | null;
  dispatched_by: string | null;
  metadata: Record<string, unknown> | null;
  dispatched_at: string;
}

export interface DispatchPurchaseOrderPayload {
  channel: DispatchChannel;
  recipient?: string | null;
}

export interface PurchaseOrderConfirmationLine {
  purchase_order_line_id: string;
  ordered_quantity: DecimalString;
  confirmed_quantity: DecimalString;
  ordered_unit_price: DecimalString;
  confirmed_unit_price: DecimalString;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  quantity_variance: DecimalString;
  quantity_variance_base: DecimalString;
  price_variance: DecimalString;
  price_variance_percent: DecimalString;
  line_total_variance: DecimalString;
  delivery_delay_days: number;
  variance_reason: string | null;
}

export interface PurchaseOrderConfirmation {
  id: string;
  purchase_order_id: string;
  confirmation_number: string;
  has_variance: boolean;
  requires_review: boolean;
  notes: string | null;
  confirmed_at: string;
  price_variance_total: DecimalString;
  quantity_variance_total: DecimalString;
  lines?: PurchaseOrderConfirmationLine[];
}

export interface ConfirmationLinePayload {
  purchase_order_line_id: string;
  confirmed_quantity?: number | null;
  confirmed_unit_price?: number | null;
  confirmed_delivery_date?: string | null;
  variance_reason?: string | null;
}

export interface StoreConfirmationPayload {
  confirmation_number: string;
  confirmed_at?: string | null;
  confirmed_delivery_date?: string | null;
  notes?: string | null;
  lines?: ConfirmationLinePayload[];
}

export interface PurchaseOrderReminder {
  id: string;
  purchase_order_id: string;
  level: number;
  channel: string;
  trigger: string;
  days_overdue: number;
  overdue_line_ids: string[] | null;
  message_reference: string | null;
  sent_by: string | null;
  sent_at: string;
}

/** Row of `GET purchase-orders/overdue`; `order` is the purchase order resource. */
export interface OverdueOrderRow {
  order: {
    id: string;
    po_number: string;
    supplier_id?: string;
    status: string;
    currency?: string;
    total_amount?: string;
    expected_delivery_date?: string | null;
    promised_delivery_date?: string | null;
    supplier?: { company_name?: string } | null;
  };
  days_overdue: number;
  overdue_line_ids: string[];
  reminder_count: number;
  last_reminder_at: string | null;
  next_reminder_due: string | null;
}

export interface PricingPreviewPayload {
  quantity: number;
  unit_price: number;
  discount_cascade?: number[] | null;
  uom_conversion_factor?: number | null;
  exchange_rate?: number | null;
  tax_rate?: number | null;
}

export interface PricingPreview {
  discount_cascade: (DecimalString | number)[];
  effective_discount_percent: DecimalString;
  net_unit_price: DecimalString;
  line_net_amount: DecimalString;
  line_tax_amount: DecimalString;
  line_total_amount: DecimalString;
  quantity_base: DecimalString;
  net_price_per_base_unit: DecimalString;
  line_net_amount_company_currency: DecimalString;
}

export type DropshipStatus = 'pending' | 'ddt_issued' | 'partially_delivered' | 'delivered';

export interface DropshipMovement {
  purchase_order_line_id: string;
  direction: string;
  quantity_base: DecimalString;
  base_uom: string | null;
  unit_cost_base: DecimalString;
  valued_amount: DecimalString;
  moved_at: string;
}

export interface Dropshipment {
  id: string;
  purchase_order_id: string;
  sales_order_id: string;
  status: DropshipStatus;
  recipient_name: string | null;
  recipient_street: string | null;
  recipient_house_number: string | null;
  recipient_postal_code: string | null;
  recipient_city: string | null;
  recipient_region: string | null;
  recipient_country_code: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  delivery_notes: string | null;
  ddt_number: string | null;
  ddt_payload: Record<string, unknown> | null;
  supplier_shipment_reference: string | null;
  delivery_proof_reference: string | null;
  billing_authorized: boolean;
  billing_authorization_reference: string | null;
  ddt_issued_at: string | null;
  delivered_at: string | null;
  billing_authorized_at: string | null;
  virtual_stock_movements?: DropshipMovement[];
}

export interface DropshipFilters {
  status?: DropshipStatus;
  sales_order_id?: string;
  page?: number;
  per_page?: number;
}

export interface DropshipDeliveryAddress {
  name?: string | null;
  street: string;
  house_number?: string | null;
  postal_code: string;
  city: string;
  region?: string | null;
  country_code: string;
  phone?: string | null;
  email?: string | null;
  delivery_notes?: string | null;
}

export interface CreateDropshipPayload {
  sales_order_id: string;
  supplier_id: string;
  expected_delivery_date?: string | null;
  currency?: string | null;
  exchange_rate?: number | null;
  notes?: string | null;
  delivery_address: DropshipDeliveryAddress;
  lines?: {
    sales_order_item_id: string;
    supplier_catalog_id?: string | null;
    unit_price?: number | null;
    uom?: string | null;
    base_uom?: string | null;
    uom_conversion_factor?: number | null;
    discount_cascade?: number[] | null;
  }[];
}

export interface IssueDdtPayload {
  carrier?: string | null;
  tracking_number?: string | null;
  packages?: number | null;
  gross_weight?: number | null;
  transport_by?: string | null;
  shipment_date?: string | null;
}

export interface RecordDeliveryPayload {
  delivered_at?: string | null;
  delivery_proof_reference?: string | null;
  supplier_shipment_reference?: string | null;
  lines?: { purchase_order_line_id: string; quantity_delivered: number }[];
}

/** Whether a confirmation line deviates from the order in quantity, price or delivery date. */
export function confirmationLineHasVariance(line: PurchaseOrderConfirmationLine): boolean {
  return (
    Number(line.quantity_variance) !== 0 ||
    Number(line.price_variance) !== 0 ||
    line.delivery_delay_days > 0
  );
}

/**
 * Parses a cascade typed as "10 5 2.5" (separated by spaces, ";" or "+"; a comma is a decimal separator)
 * into a list of percentages. Empty text is an empty cascade; invalid text returns null.
 */
export function parseDiscountCascade(text: string | null | undefined): number[] | null {
  const raw = (text ?? '').trim();
  if (!raw) {
    return [];
  }
  const values = raw
    .split(/[\s;+]+/)
    .filter((p) => p.length > 0)
    .map((p) => Number(p.replace(',', '.')));
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
    return null;
  }
  return values;
}

/** Combined percentage of a cascade, e.g. [10, 5] => 14.5. */
export function effectiveDiscountPercent(steps: readonly number[]): number {
  const remaining = steps.reduce((acc, s) => acc * (1 - s / 100), 1);
  return Math.round((1 - remaining) * 1_000_000) / 10_000;
}

/** Tag colour of a dropshipment status. */
export function dropshipStatusColor(status: DropshipStatus): string {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'partially_delivered':
      return 'warning';
    case 'ddt_issued':
      return 'blue';
    default:
      return 'default';
  }
}
