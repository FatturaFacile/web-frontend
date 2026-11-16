import { QueryFilterParams } from './api.models';

export type DeliveryNoteType =
  | 'outbound_sale'
  | 'internal_transfer'
  | 'subcontracting_out'
  | 'subcontracting_return'
  | 'customer_consignment'
  | 'vendor_consignment_return'
  | 'return_from_customer';

export type DeliveryNoteStatus =
  'draft' | 'issued' | 'in_transit' | 'delivered' | 'partially_invoiced' | 'invoiced' | 'cancelled';

export type TransportReason =
  | 'sale'
  | 'internal_transfer'
  | 'subcontracting'
  | 'consignment'
  | 'consignment_delivery'
  | 'consignment_return'
  | 'subcontractor_return'
  | 'repair'
  | 'gift'
  | 'return';

export type CarriageTerms = 'free' | 'collect' | 'free_with_charge';
export type LogisticsTransportBy = 'sender' | 'recipient' | 'carrier';

export const DELIVERY_NOTE_TYPES: readonly DeliveryNoteType[] = [
  'outbound_sale',
  'internal_transfer',
  'subcontracting_out',
  'subcontracting_return',
  'customer_consignment',
  'vendor_consignment_return',
  'return_from_customer',
];

export const DELIVERY_NOTE_STATUSES: readonly DeliveryNoteStatus[] = [
  'draft',
  'issued',
  'in_transit',
  'delivered',
  'partially_invoiced',
  'invoiced',
  'cancelled',
];

export const TRANSPORT_REASONS: readonly TransportReason[] = [
  'sale',
  'internal_transfer',
  'subcontracting',
  'consignment',
  'repair',
  'gift',
  'return',
];

export const CARRIAGE_TERMS: readonly CarriageTerms[] = ['free', 'collect', 'free_with_charge'];
export const TRANSPORT_BY: readonly LogisticsTransportBy[] = ['sender', 'recipient', 'carrier'];
export const INCOTERMS: readonly string[] = [
  'EXW',
  'FCA',
  'CPT',
  'CIP',
  'DAP',
  'DPU',
  'DDP',
  'FAS',
  'FOB',
  'CFR',
  'CIF',
];

export interface DeliveryNoteItemResource {
  id: string;
  product_id: string | null;
  sales_order_item_id: string | null;
  description: string;
  quantity: number | string;
  invoiced_quantity: number | string;
  unit_price: number | string;
  tax_rate: number | string;
  uom: string | null;
}

export interface LogisticsDeliveryNote {
  id: string;
  ddt_number: string;
  date: string;
  type: DeliveryNoteType;
  status: DeliveryNoteStatus;
  shipping_status: string;
  transport_reason_code: TransportReason | null;
  carriage_terms: CarriageTerms | null;
  transport_by: LogisticsTransportBy | null;
  contact_id: string | null;
  supplier_id: string | null;
  origin_warehouse_id: string | null;
  destination_warehouse_id: string | null;
  sales_order_id: string | null;
  stock_transfer_order_id: string | null;
  carrier_name: string | null;
  carrier_vat_number: string | null;
  carrier_license_plate: string | null;
  departure_time: string | null;
  goods_appearance: string | null;
  packages_count: number | null;
  gross_weight_kg: number | string | null;
  net_weight_kg: number | string | null;
  volume_m3: number | string | null;
  incoterms: string | null;
  tracking_number: string | null;
  carrier_tracking_url: string | null;
  recipient_signature_name: string | null;
  currency: string;
  show_prices: boolean;
  notes: string | null;
  items?: DeliveryNoteItemResource[];
}

export interface DeliveryNoteFilterParams extends QueryFilterParams {
  status?: DeliveryNoteStatus;
  type?: DeliveryNoteType;
  transport_reason_code?: TransportReason;
  contact_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface LogisticsDeliveryNoteLinePayload {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price?: number;
  tax_rate?: number;
  uom?: string | null;
}

export interface DeliveryNotePayload {
  type: DeliveryNoteType;
  contact_id?: string | null;
  supplier_id?: string | null;
  origin_warehouse_id?: string | null;
  destination_warehouse_id?: string | null;
  date?: string;
  transport_reason_code?: TransportReason;
  carriage_terms?: CarriageTerms | null;
  transport_by?: LogisticsTransportBy | null;
  carrier_name?: string | null;
  carrier_vat_number?: string | null;
  carrier_license_plate?: string | null;
  departure_time?: string | null;
  goods_appearance?: string | null;
  packages_count?: number | null;
  gross_weight_kg?: number | null;
  net_weight_kg?: number | null;
  volume_m3?: number | null;
  incoterms?: string | null;
  tracking_number?: string | null;
  carrier_tracking_url?: string | null;
  currency?: string;
  notes?: string | null;
  show_prices?: boolean;
  items: LogisticsDeliveryNoteLinePayload[];
}

export interface DeliveryNoteFromOrdersPayload extends Omit<
  Partial<DeliveryNotePayload>,
  'items' | 'type'
> {
  orders: { sales_order_id: string; items?: { sales_order_item_id: string; quantity: number }[] }[];
}

export interface DeliveryNotePdfOptions {
  hide_prices?: boolean;
  lang?: 'it' | 'en' | 'de' | 'fr';
}

export interface UnbilledGroup {
  contact_id: string;
  currency: string;
  delivery_notes: { id: string; ddt_number: string; date: string; status: DeliveryNoteStatus }[];
}

export interface LookupWarehouse {
  id: string;
  code: string;
  name: string;
  warehouse_type: string;
  legal_owner_type: string;
  linked_partner_id: string | null;
  company_entity_id: string | null;
}

export interface LookupProduct {
  id: string;
  sku: string;
  name: string;
  unit_measure: string | null;
  cost_price: number | string;
  sale_price: number | string;
  tax_rate: number | string;
}

export interface LookupPartner {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  type: string | null;
}

export interface OpenOrderItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  quantity_delivered: number;
  remaining: number;
  unit_price: number;
}

export interface OpenOrder {
  id: string;
  order_number: string;
  contact_id: string;
  currency: string;
  items: OpenOrderItem[];
}

export type TransferPurpose =
  | 'inter_warehouse'
  | 'technician_van'
  | 'inter_company'
  | 'customer_consignment'
  | 'consignment_return'
  | 'subcontracting'
  | 'subcontracting_return';
/** `reconciled` is the pre-WMS name of `closed`, kept so cached/legacy payloads still type-check. */
export type TransferStatus =
  | 'draft'
  | 'approved'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'discrepancy_pending'
  | 'closed'
  | 'reconciled'
  | 'cancelled';
export type DiscrepancyStatus =
  'pending_approval' | 'approved_write_off' | 'carrier_claim' | 'returned_to_origin';
export type DiscrepancyResolution = Exclude<DiscrepancyStatus, 'pending_approval'>;

export const TRANSFER_PURPOSES: readonly TransferPurpose[] = [
  'inter_warehouse',
  'technician_van',
  'inter_company',
  'customer_consignment',
  'consignment_return',
  'subcontracting',
  'subcontracting_return',
];
export const DISCREPANCY_RESOLUTIONS: readonly DiscrepancyResolution[] = [
  'approved_write_off',
  'carrier_claim',
  'returned_to_origin',
];
export interface StockTransferLine {
  id: string;
  product_id: string;
  description: string | null;
  quantity: number | string;
  shipped_qty: number | string;
  received_qty: number | string;
  damaged_qty?: number | string;
  discrepancy_qty: number | string;
  discrepancy_reason: string | null;
}

export interface TransferDiscrepancy {
  id: string;
  stock_transfer_order_id: string;
  stock_transfer_order_line_id?: string;
  product_id: string;
  discrepancy_qty: number | string;
  shortage_qty?: number | string;
  damage_qty?: number | string;
  discrepancy_reason: string | null;
  status: DiscrepancyStatus;
}

export interface StockTransferResource {
  id: string;
  transfer_number: string;
  purpose: TransferPurpose;
  status: TransferStatus;
  origin_warehouse_id: string;
  transit_warehouse_id: string | null;
  destination_warehouse_id: string;
  delivery_note_id: string | null;
  inter_company_invoice_id?: string | null;
  is_inter_company: boolean;
  shipped_at: string | null;
  received_at: string | null;
  approved_at?: string | null;
  closed_at?: string | null;
  notes?: string | null;
  lines?: StockTransferLine[];
  discrepancies?: TransferDiscrepancy[];
}

export type TransferDirection = 'inbound' | 'outbound';

export interface StockTransferFilterParams extends QueryFilterParams {
  /** One status or a comma separated list (`in_transit,partially_received`). */
  status?: string;
  purpose?: TransferPurpose;
  /** `1` restricts the list to inter-company transfers. */
  is_inter_company?: 1;
  warehouse_id?: string;
  direction?: TransferDirection;
}

export interface StockTransferPayload {
  purpose: TransferPurpose;
  origin_warehouse_id: string;
  destination_warehouse_id: string;
  transit_warehouse_id?: string;
  notes?: string;
  lines: { product_id: string; quantity: number; description?: string }[];
}

/** Carrier / transport data collected by the dispatch wizard; every field is optional on the API. */
export interface ShipTransferPayload {
  carrier_name?: string;
  carrier_license_plate?: string;
  transport_by?: LogisticsTransportBy;
  carriage_terms?: CarriageTerms;
  goods_appearance?: string;
  packages_count?: number;
  gross_weight_kg?: number;
}

export interface ReceiveLinePayload {
  line_id: string;
  /** Good units accepted by this receipt. */
  received_qty: number;
  damaged_qty?: number;
  discrepancy_reason?: string | null;
}

export interface ReceiveTransferPayload {
  /** `false` records a partial receipt: the remainder stays in transit. Defaults to `true` on the API. */
  final?: boolean;
  /** Omitted lines receive everything that is still outstanding. */
  lines?: ReceiveLinePayload[];
}

export interface ScanTransferResult {
  line: StockTransferLine;
  outstanding_qty: number | string;
}

export interface ConsignmentLedgerRow {
  product_id: string;
  sku: string | null;
  name: string | null;
  opening_qty: number;
  sent_qty: number;
  consumed_qty: number;
  returned_qty: number;
  residual_qty: number;
  unit_cost: number;
  fiscal_value: number;
  ddt_references: string[];
}

export interface ConsignmentLedgerWarehouse {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  warehouse_type: string;
  legal_owner_type: string;
  partner_id: string | null;
  on_balance_sheet: boolean;
  total_fiscal_value: number;
  rows: ConsignmentLedgerRow[];
}

/** Third-party stock register: three sections of per-warehouse ledgers plus the segregated valuation. */
export interface ThirdPartyRegister {
  goods_at_customers: ConsignmentLedgerWarehouse[];
  goods_at_subcontractors: ConsignmentLedgerWarehouse[];
  vendor_consignment_held: ConsignmentLedgerWarehouse[];
  valuation?: InventoryValuation;
}

export interface ThirdPartyRegisterFilters {
  partner_id?: string;
  from?: string;
  to?: string;
}

export type ValuationBucketKey =
  | 'owned_on_hand'
  | 'owned_in_transit'
  | 'owned_at_customer_consignment'
  | 'owned_at_subcontractor'
  | 'third_party_vendor_consignment_held';

export const VALUATION_BUCKETS: readonly ValuationBucketKey[] = [
  'owned_on_hand',
  'owned_in_transit',
  'owned_at_customer_consignment',
  'owned_at_subcontractor',
  'third_party_vendor_consignment_held',
];

export interface InventoryValuationWarehouse {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_type: string;
  legal_owner_type: string;
  bucket: ValuationBucketKey;
  value: number;
  on_balance_sheet: boolean;
}

export interface InventoryValuation {
  total_balance_sheet_value: number;
  excluded_third_party_value: number;
  buckets?: Record<ValuationBucketKey, number>;
  by_warehouse_type: Record<string, number>;
  by_warehouse?: InventoryValuationWarehouse[];
}

export interface ConsumptionLinePayload {
  product_id: string;
  quantity: number;
  unit_price?: number | null;
  tax_rate?: number | null;
}

export interface ConsumptionPayload {
  warehouse_id: string;
  agreement_id?: string;
  period_start: string;
  period_end: string;
  notes?: string;
  lines: ConsumptionLinePayload[];
}

export type ConsignmentDirection = 'customer' | 'vendor';

export interface ConsumptionReport {
  id: string;
  warehouse_id: string;
  agreement_id?: string | null;
  direction: ConsignmentDirection;
  status: string;
  generated_document_type: 'sales_invoice' | 'purchase_order' | string | null;
  generated_document_id: string | null;
  total_amount: number | string;
  period_start?: string;
  period_end?: string;
  ownership_from?: string | null;
  ownership_to?: string | null;
  lines?: ConsumptionLinePayload[];
}

export type ConsignmentBillingFrequency = 'monthly' | 'quarterly' | 'on_demand';
export const CONSIGNMENT_BILLING_FREQUENCIES: readonly ConsignmentBillingFrequency[] = [
  'monthly',
  'quarterly',
  'on_demand',
];

export interface ConsignmentAgreement {
  id: string;
  agreement_number: string;
  direction: ConsignmentDirection;
  partner_id: string;
  warehouse_id: string;
  status: 'active' | 'terminated';
  billing_frequency: ConsignmentBillingFrequency;
  valid_from: string;
  valid_to: string | null;
  payment_terms_days: number;
  notes: string | null;
}

export interface ConsignmentAgreementPayload {
  warehouse_id: string;
  partner_id?: string;
  agreement_number?: string;
  valid_from: string;
  valid_to?: string;
  billing_frequency?: ConsignmentBillingFrequency;
  payment_terms_days?: number;
  notes?: string;
}

export interface ConsignmentAgreementFilters extends QueryFilterParams {
  direction?: ConsignmentDirection;
  status?: 'active' | 'terminated';
}

export interface VendorReceiptPayload {
  warehouse_id: string;
  lines: { product_id: string; quantity: number }[];
}

/** Permission codes enforced by the API (see LogisticsPermissions on the backend). */
export const LOGISTICS_PERMISSIONS = {
  view: 'delivery_notes.view',
  create: 'delivery_notes.create',
  update: 'delivery_notes.update',
  delete: 'delivery_notes.delete',
  issue: 'delivery_notes.issue',
  cancel: 'delivery_notes.cancel',
  invoice: 'delivery_notes.invoice',
  pdf: 'delivery_notes.pdf',
  transfers: 'logistics.transfers.manage',
  /** Manager sign-off: approve, close and resolve discrepancies of a transfer order. */
  approveTransfers: 'logistics.transfers.approve',
  consignment: 'logistics.consignment.reconcile',
} as const;
