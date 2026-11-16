/**
 * Pure business rules of the warehouse transfer workflow and of the consignment declaration. No Angular, no I/O:
 * the components only bind the results, which keeps the state machine, the variance maths and the declaration
 * totals unit-testable. They mirror the API (StockTransferService, ConsignmentService).
 */
import {
  CarriageTerms,
  ConsignmentDirection,
  InventoryValuation,
  LOGISTICS_PERMISSIONS,
  LogisticsTransportBy,
  LookupWarehouse,
  ReceiveLinePayload,
  ReceiveTransferPayload,
  ShipTransferPayload,
  StockTransferFilterParams,
  StockTransferLine,
  StockTransferResource,
  TransferPurpose,
  TransferStatus,
  VALUATION_BUCKETS,
  ValuationBucketKey,
} from '@core';

export type NumericLike = number | string | null | undefined;

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/** Quantities travel as numbers or decimal strings (4 decimals); anything unparsable counts as zero. */
export function toQty(value: NumericLike): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? round(parsed, 4) : 0;
}

// ---------------------------------------------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------------------------------------------

type StatusLike = Pick<StockTransferResource, 'status'>;

export const canApprove = (t: StatusLike): boolean => t.status === 'draft';
export const canShip = (t: StatusLike): boolean => t.status === 'approved';
export const canReceive = (t: StatusLike): boolean =>
  t.status === 'in_transit' || t.status === 'partially_received';
/** Only a fully received transfer is closed by hand; with discrepancies the last resolution closes it. */
export const canClose = (t: StatusLike): boolean => t.status === 'received';
export const canCancel = (t: StatusLike): boolean =>
  t.status === 'draft' || t.status === 'approved';
export const canResolveDiscrepancies = (t: StatusLike): boolean =>
  t.status === 'discrepancy_pending';

export type TransferAction = 'approve' | 'ship' | 'receive' | 'close' | 'cancel' | 'resolve';

const ACTION_RULES: Record<
  TransferAction,
  { allowed: (t: StatusLike) => boolean; permission: string }
> = {
  approve: { allowed: canApprove, permission: LOGISTICS_PERMISSIONS.approveTransfers },
  ship: { allowed: canShip, permission: LOGISTICS_PERMISSIONS.transfers },
  receive: { allowed: canReceive, permission: LOGISTICS_PERMISSIONS.transfers },
  close: { allowed: canClose, permission: LOGISTICS_PERMISSIONS.approveTransfers },
  cancel: { allowed: canCancel, permission: LOGISTICS_PERMISSIONS.transfers },
  resolve: { allowed: canResolveDiscrepancies, permission: LOGISTICS_PERMISSIONS.approveTransfers },
};

/** Permission needed to run an action: approve / close / resolve are a manager sign-off. */
export const permissionForAction = (action: TransferAction): string =>
  ACTION_RULES[action].permission;

/** Actions the user can run on a transfer right now: state machine and RBAC combined. */
export function availableActions(
  transfer: StatusLike,
  can: (permission: string) => boolean,
): TransferAction[] {
  return (Object.keys(ACTION_RULES) as TransferAction[]).filter(
    (action) => ACTION_RULES[action].allowed(transfer) && can(ACTION_RULES[action].permission),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Step tracker
// ---------------------------------------------------------------------------------------------------------------

export const TRACKER_STEPS = ['draft', 'approved', 'shipped', 'received', 'closed'] as const;
export type TrackerStep = (typeof TRACKER_STEPS)[number];

export interface TrackerState {
  /** Index into {@link TRACKER_STEPS} of the step the transfer is in. */
  current: number;
  status: 'process' | 'finish' | 'error';
  /** Goods are partly received: the receipt step is still open. */
  partial: boolean;
  cancelled: boolean;
}

/** Maps a transfer status onto the Draft -> Approved -> Shipped -> Received -> Closed tracker. */
export function trackerState(status: TransferStatus): TrackerState {
  switch (status) {
    case 'draft':
      return { current: 0, status: 'process', partial: false, cancelled: false };
    case 'approved':
      return { current: 1, status: 'process', partial: false, cancelled: false };
    case 'in_transit':
      return { current: 2, status: 'process', partial: false, cancelled: false };
    case 'partially_received':
      return { current: 3, status: 'process', partial: true, cancelled: false };
    case 'discrepancy_pending':
      return { current: 3, status: 'error', partial: false, cancelled: false };
    case 'received':
      return { current: 4, status: 'process', partial: false, cancelled: false };
    case 'closed':
    case 'reconciled':
      return { current: 4, status: 'finish', partial: false, cancelled: false };
    case 'cancelled':
      return { current: 0, status: 'error', partial: false, cancelled: true };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// List filters
// ---------------------------------------------------------------------------------------------------------------

export type MovementTypeFilter =
  'inter_warehouse' | 'inter_company' | 'customer_consignment' | 'subcontracting';

export const MOVEMENT_TYPE_FILTERS: readonly MovementTypeFilter[] = [
  'inter_warehouse',
  'inter_company',
  'customer_consignment',
  'subcontracting',
];

/** Query params for a movement type; the keys of the other kind are cleared so filters never stack up. */
export function movementTypeParams(
  type: MovementTypeFilter | null | undefined,
): Pick<StockTransferFilterParams, 'purpose' | 'is_inter_company'> {
  if (!type) return { purpose: undefined, is_inter_company: undefined };
  if (type === 'inter_company') return { purpose: undefined, is_inter_company: 1 };
  return { purpose: type, is_inter_company: undefined };
}

/** Inverse of {@link movementTypeParams}, used to show the current selection. */
export function movementTypeFromParams(
  params: Pick<StockTransferFilterParams, 'purpose' | 'is_inter_company'>,
): MovementTypeFilter | null {
  if (params.is_inter_company === 1) return 'inter_company';
  const match = MOVEMENT_TYPE_FILTERS.find((type) => type === params.purpose);
  return match ?? null;
}

export type StatusFilter =
  'draft' | 'approved' | 'in_transit' | 'discrepancy' | 'received' | 'closed' | 'cancelled';

export const STATUS_FILTERS: readonly StatusFilter[] = [
  'draft',
  'approved',
  'in_transit',
  'discrepancy',
  'received',
  'closed',
  'cancelled',
];

const STATUS_FILTER_STATUSES: Record<StatusFilter, readonly TransferStatus[]> = {
  draft: ['draft'],
  approved: ['approved'],
  in_transit: ['in_transit', 'partially_received'],
  discrepancy: ['discrepancy_pending'],
  received: ['received'],
  closed: ['closed'],
  cancelled: ['cancelled'],
};

/** Comma separated `status` query value for a status filter (In Transit includes partial receipts). */
export function statusFilterParam(filter: StatusFilter | null | undefined): string | undefined {
  return filter ? STATUS_FILTER_STATUSES[filter].join(',') : undefined;
}

export function statusFilterFromParam(param: string | undefined): StatusFilter | null {
  if (!param) return null;
  return STATUS_FILTERS.find((filter) => statusFilterParam(filter) === param) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Fiscal data derived from the purpose (mirrors TransferPurpose on the API)
// ---------------------------------------------------------------------------------------------------------------

export type TransportReasonCode =
  | 'internal_transfer'
  | 'consignment_delivery'
  | 'consignment_return'
  | 'subcontracting'
  | 'subcontractor_return';

const PURPOSE_REASON: Record<TransferPurpose, TransportReasonCode> = {
  inter_warehouse: 'internal_transfer',
  technician_van: 'internal_transfer',
  inter_company: 'internal_transfer',
  customer_consignment: 'consignment_delivery',
  consignment_return: 'consignment_return',
  subcontracting: 'subcontracting',
  subcontracting_return: 'subcontractor_return',
};

const PURPOSE_DDT_TYPE: Record<TransferPurpose, string> = {
  inter_warehouse: 'internal_transfer',
  technician_van: 'internal_transfer',
  inter_company: 'internal_transfer',
  customer_consignment: 'customer_consignment',
  consignment_return: 'customer_consignment_return',
  subcontracting: 'subcontracting_out',
  subcontracting_return: 'subcontracting_return',
};

/** Fiscal "causale del trasporto" printed on the DDT generated at dispatch. */
export const transportReasonForPurpose = (purpose: TransferPurpose): TransportReasonCode =>
  PURPOSE_REASON[purpose];

export const ddtTypeForPurpose = (purpose: TransferPurpose): string => PURPOSE_DDT_TYPE[purpose];

/** Moves between own warehouses carry no prices on the DDT; anything involving a third party does. */
export const ddtShowsPrices = (purpose: TransferPurpose): boolean =>
  purpose !== 'inter_warehouse' && purpose !== 'technician_van';

/** Inter-company shipments also draft a sales invoice towards the receiving legal entity. */
export const draftsInterCompanyInvoice = (
  transfer: Pick<StockTransferResource, 'is_inter_company' | 'purpose'>,
): boolean => transfer.is_inter_company || transfer.purpose === 'inter_company';

// ---------------------------------------------------------------------------------------------------------------
// Receipt: variance and validation
// ---------------------------------------------------------------------------------------------------------------

/** What the operator typed for a line: good and damaged units of THIS receipt. */
export interface ReceiptLineInput {
  good: number;
  damaged: number;
  reason: string;
}

export type ReceiptLineLike = Pick<
  StockTransferLine,
  'id' | 'shipped_qty' | 'received_qty' | 'damaged_qty'
>;

/** Units still on the road: shipped - received - damaged (never negative). */
export function outstandingQty(line: ReceiptLineLike): number {
  return Math.max(
    0,
    toQty(toQty(line.shipped_qty) - toQty(line.received_qty) - toQty(line.damaged_qty)),
  );
}

export interface LineVariance {
  outstanding: number;
  good: number;
  damaged: number;
  /** Outstanding units this receipt leaves unaccounted for (negative when over-receiving). */
  remaining: number;
  /** Quantity accounted for as a loss when the receipt is final. */
  shortage: number;
  /** Damaged units, or a shortage on a final receipt: the line needs a discrepancy reason. */
  hasVariance: boolean;
}

export function computeVariance(
  line: ReceiptLineLike,
  input: Pick<ReceiptLineInput, 'good' | 'damaged'>,
  final: boolean,
): LineVariance {
  const outstanding = outstandingQty(line);
  const good = toQty(input.good);
  const damaged = toQty(input.damaged);
  const remaining = toQty(outstanding - good - damaged);
  const shortage = final ? Math.max(0, remaining) : 0;
  return {
    outstanding,
    good,
    damaged,
    remaining,
    shortage,
    hasVariance: damaged > 0 || shortage > 0,
  };
}

export type ReceiptIssue = 'NEGATIVE' | 'EXCEEDS_OUTSTANDING' | 'REASON_REQUIRED';

export function validateReceiptLine(
  line: ReceiptLineLike,
  input: ReceiptLineInput,
  final: boolean,
): ReceiptIssue[] {
  const issues: ReceiptIssue[] = [];
  const variance = computeVariance(line, input, final);
  if (variance.good < 0 || variance.damaged < 0) issues.push('NEGATIVE');
  if (variance.remaining < 0) issues.push('EXCEEDS_OUTSTANDING');
  if (variance.hasVariance && input.reason.trim() === '') issues.push('REASON_REQUIRED');
  return issues;
}

export interface ReceiptValidation {
  valid: boolean;
  lineIssues: Record<string, ReceiptIssue[]>;
  /** A partial receipt must book at least one unit. */
  nothingReceived: boolean;
  /** Final receipt that leaves units behind: they become discrepancies awaiting manager approval. */
  hasDiscrepancy: boolean;
}

export function validateReceipt(
  lines: readonly ReceiptLineLike[],
  inputs: Readonly<Record<string, ReceiptLineInput>>,
  final: boolean,
): ReceiptValidation {
  const lineIssues: Record<string, ReceiptIssue[]> = {};
  let booked = 0;
  let hasDiscrepancy = false;
  for (const line of lines) {
    const input = inputs[line.id] ?? defaultReceiptInput(line);
    const issues = validateReceiptLine(line, input, final);
    if (issues.length > 0) lineIssues[line.id] = issues;
    booked += toQty(input.good) + toQty(input.damaged);
    if (computeVariance(line, input, final).hasVariance) hasDiscrepancy = true;
  }
  const nothingReceived = !final && booked <= 0;
  return {
    valid: Object.keys(lineIssues).length === 0 && !nothingReceived,
    lineIssues,
    nothingReceived,
    hasDiscrepancy,
  };
}

/** Receiving everything that is outstanding is the default for the operator. */
export function defaultReceiptInput(line: ReceiptLineLike): ReceiptLineInput {
  return { good: outstandingQty(line), damaged: 0, reason: '' };
}

/**
 * Builds the receive request. Lines the API does not hear about receive everything outstanding, so every line that is
 * still in transit is sent explicitly, with `0` for the ones the operator leaves behind in a partial receipt.
 */
export function buildReceivePayload(
  lines: readonly ReceiptLineLike[],
  inputs: Readonly<Record<string, ReceiptLineInput>>,
  final: boolean,
): ReceiveTransferPayload {
  const payloadLines: ReceiveLinePayload[] = [];
  for (const line of lines) {
    if (outstandingQty(line) <= 0) continue;
    const input = inputs[line.id] ?? defaultReceiptInput(line);
    const reason = input.reason.trim();
    payloadLines.push({
      line_id: line.id,
      received_qty: toQty(input.good),
      damaged_qty: toQty(input.damaged),
      discrepancy_reason: reason === '' ? null : reason,
    });
  }
  return { final, lines: payloadLines };
}

// ---------------------------------------------------------------------------------------------------------------
// Consignment declaration
// ---------------------------------------------------------------------------------------------------------------

export interface DeclarationLineInput {
  quantity: number;
  unit_price: number;
  /** VAT rate in percent. */
  tax_rate: number;
}

export interface DeclarationLineTotals {
  net: number;
  tax: number;
  gross: number;
}

export interface DeclarationTotals extends DeclarationLineTotals {
  lines: DeclarationLineTotals[];
  /** Net amount per VAT rate, for the document preview. */
  byRate: { rate: number; net: number; tax: number }[];
}

export function declarationLineTotals(line: DeclarationLineInput): DeclarationLineTotals {
  const net = round(Math.max(0, line.quantity) * Math.max(0, line.unit_price), 2);
  const tax = round((net * Math.max(0, line.tax_rate)) / 100, 2);
  return { net, tax, gross: round(net + tax, 2) };
}

export function declarationTotals(lines: readonly DeclarationLineInput[]): DeclarationTotals {
  const perLine = lines.map(declarationLineTotals);
  const rates = new Map<number, { net: number; tax: number }>();
  lines.forEach((line, index) => {
    const bucket = rates.get(line.tax_rate) ?? { net: 0, tax: 0 };
    bucket.net = round(bucket.net + perLine[index].net, 2);
    bucket.tax = round(bucket.tax + perLine[index].tax, 2);
    rates.set(line.tax_rate, bucket);
  });
  const net = round(
    perLine.reduce((sum, l) => sum + l.net, 0),
    2,
  );
  const tax = round(
    perLine.reduce((sum, l) => sum + l.tax, 0),
    2,
  );
  return {
    net,
    tax,
    gross: round(net + tax, 2),
    lines: perLine,
    byRate: [...rates.entries()]
      .map(([rate, amounts]) => ({ rate, ...amounts }))
      .sort((a, b) => a.rate - b.rate),
  };
}

export type DeclarationLineIssue = 'NOT_POSITIVE' | 'EXCEEDS_RESIDUAL';

/** A declared quantity must be positive and cannot exceed the stock still held by the third party. */
export function validateDeclarationLine(
  quantity: number,
  residual: number,
): DeclarationLineIssue[] {
  const issues: DeclarationLineIssue[] = [];
  if (!(quantity > 0)) issues.push('NOT_POSITIVE');
  if (quantity > residual) issues.push('EXCEEDS_RESIDUAL');
  return issues;
}

export type GeneratedDocumentKind = 'sales_invoice' | 'purchase_order';

/** Customer consignment is billed to the customer; vendor consignment becomes a purchase order. */
export const generatedDocumentKind = (direction: ConsignmentDirection): GeneratedDocumentKind =>
  direction === 'customer' ? 'sales_invoice' : 'purchase_order';

/** Direction of a declaration derived from the warehouse it is declared on. */
export function directionForWarehouseType(warehouseType: string): ConsignmentDirection | null {
  if (warehouseType === 'customer_consignment') return 'customer';
  if (warehouseType === 'vendor_consignment') return 'vendor';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Warehouse routing per purpose (mirrors StockTransferService::assertRouteMatchesPurpose)
// ---------------------------------------------------------------------------------------------------------------

export type RoutedWarehouse = Pick<
  LookupWarehouse,
  'warehouse_type' | 'legal_owner_type' | 'company_entity_id' | 'linked_partner_id'
>;

const ORIGIN_TYPE: Partial<Record<TransferPurpose, string>> = {
  consignment_return: 'customer_consignment',
  subcontracting_return: 'subcontractor',
};

const DESTINATION_TYPE: Partial<Record<TransferPurpose, string>> = {
  customer_consignment: 'customer_consignment',
  subcontracting: 'subcontractor',
  technician_van: 'mobile_van',
};

const OWN_PREMISES = ['standard', 'mobile_van'];

/** Origins are always our own, non-virtual warehouses; returns start from the third party holding our goods. */
export function isValidOrigin(purpose: TransferPurpose, warehouse: RoutedWarehouse): boolean {
  if (warehouse.warehouse_type === 'transit' || warehouse.legal_owner_type !== 'company') {
    return false;
  }
  const required = ORIGIN_TYPE[purpose];
  return required === undefined || warehouse.warehouse_type === required;
}

export function isValidDestination(
  purpose: TransferPurpose,
  warehouse: RoutedWarehouse,
  origin?: RoutedWarehouse,
): boolean {
  const required = DESTINATION_TYPE[purpose];
  if (required !== undefined && warehouse.warehouse_type !== required) return false;

  const needsOwnPremises =
    purpose === 'consignment_return' ||
    purpose === 'subcontracting_return' ||
    purpose === 'inter_company';
  if (needsOwnPremises && !OWN_PREMISES.includes(warehouse.warehouse_type)) return false;

  if (
    purpose === 'inter_warehouse' &&
    ['transit', 'vendor_consignment'].includes(warehouse.warehouse_type)
  ) {
    return false;
  }

  if (purpose === 'inter_company') {
    const entity = warehouse.company_entity_id;
    if (!entity || warehouse.linked_partner_id === null) return false;
    if (origin?.company_entity_id && origin.company_entity_id === entity) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Dispatch form
// ---------------------------------------------------------------------------------------------------------------

export interface ShipFormValue {
  transport_by: LogisticsTransportBy;
  carrier_name: string;
  carrier_license_plate: string;
  carriage_terms: CarriageTerms;
  goods_appearance: string;
  packages_count: number | null;
  gross_weight_kg: number | null;
}

/** Drops blank fields so the API applies its own defaults; the carrier is only sent when a carrier transports. */
export function buildShipPayload(value: ShipFormValue): ShipTransferPayload {
  const text = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  const carrierTransports = value.transport_by === 'carrier';
  const payload: ShipTransferPayload = {
    transport_by: value.transport_by,
    carriage_terms: value.carriage_terms,
    carrier_name: carrierTransports ? text(value.carrier_name) : undefined,
    carrier_license_plate: text(value.carrier_license_plate),
    goods_appearance: text(value.goods_appearance),
    packages_count:
      value.packages_count !== null && value.packages_count >= 0
        ? Math.trunc(value.packages_count)
        : undefined,
    gross_weight_kg:
      value.gross_weight_kg !== null && value.gross_weight_kg >= 0
        ? value.gross_weight_kg
        : undefined,
  };
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  ) as ShipTransferPayload;
}

/** A carrier must be named when the goods travel with one. */
export const carrierRequired = (transportBy: LogisticsTransportBy): boolean =>
  transportBy === 'carrier';

/** Local calendar date as YYYY-MM-DD (toISOString would shift it by the timezone offset). */
export function toIsoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Fiscal valuation: owned stock vs third-party consignment stock
// ---------------------------------------------------------------------------------------------------------------

export interface ValuationBucketRow {
  key: ValuationBucketKey;
  value: number;
  /** Share of the group the bucket belongs to, 0-100. */
  share: number;
}

export interface ValuationBreakdown {
  /** The four buckets that belong on the balance sheet. */
  owned: ValuationBucketRow[];
  ownedTotal: number;
  /** Vendor consignment goods held on our premises: legally the vendor's, so off balance sheet. */
  thirdParty: ValuationBucketRow;
  /** Owned + third party: the physical value on hand, shown for reconciliation only. */
  physicalTotal: number;
}

export function valuationBreakdown(valuation: InventoryValuation): ValuationBreakdown {
  const value = (key: ValuationBucketKey): number => round(valuation.buckets?.[key] ?? 0, 2);
  const ownedKeys = VALUATION_BUCKETS.filter(
    (key) => key !== 'third_party_vendor_consignment_held',
  );
  const ownedTotal = round(
    ownedKeys.reduce((sum, key) => sum + value(key), 0),
    2,
  );
  const share = (amount: number): number =>
    ownedTotal > 0 ? round((amount / ownedTotal) * 100, 1) : 0;
  const thirdParty = value('third_party_vendor_consignment_held');
  return {
    owned: ownedKeys.map((key) => ({ key, value: value(key), share: share(value(key)) })),
    ownedTotal,
    thirdParty: { key: 'third_party_vendor_consignment_held', value: thirdParty, share: 100 },
    physicalTotal: round(ownedTotal + thirdParty, 2),
  };
}
