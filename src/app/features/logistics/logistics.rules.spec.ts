import { describe, expect, it } from 'vitest';
import {
  InventoryValuation,
  LOGISTICS_PERMISSIONS,
  StockTransferResource,
  TransferStatus,
} from '@core';
import {
  availableActions,
  buildReceivePayload,
  buildShipPayload,
  canApprove,
  canCancel,
  canClose,
  canReceive,
  canResolveDiscrepancies,
  carrierRequired,
  canShip,
  computeVariance,
  ddtShowsPrices,
  ddtTypeForPurpose,
  declarationTotals,
  defaultReceiptInput,
  directionForWarehouseType,
  isValidDestination,
  isValidOrigin,
  draftsInterCompanyInvoice,
  generatedDocumentKind,
  movementTypeFromParams,
  movementTypeParams,
  outstandingQty,
  ReceiptLineInput,
  RoutedWarehouse,
  ShipFormValue,
  statusFilterFromParam,
  statusFilterParam,
  toIsoDate,
  valuationBreakdown,
  toQty,
  trackerState,
  transportReasonForPurpose,
  validateDeclarationLine,
  validateReceipt,
  validateReceiptLine,
} from './logistics.rules';

const ALL_STATUSES: TransferStatus[] = [
  'draft',
  'approved',
  'in_transit',
  'partially_received',
  'received',
  'discrepancy_pending',
  'closed',
  'reconciled',
  'cancelled',
];

const line = (shipped: number, received = 0, damaged = 0, id = 'l1') => ({
  id,
  shipped_qty: shipped,
  received_qty: received,
  damaged_qty: damaged,
});

const input = (good: number, damaged = 0, reason = ''): ReceiptLineInput => ({
  good,
  damaged,
  reason,
});

const statusesWhere = (predicate: (t: { status: TransferStatus }) => boolean): TransferStatus[] =>
  ALL_STATUSES.filter((status) => predicate({ status }));

describe('transfer state machine', () => {
  it('approves drafts only', () => {
    expect(statusesWhere(canApprove)).toEqual(['draft']);
  });

  it('ships approved transfers only (a draft must be signed off first)', () => {
    expect(statusesWhere(canShip)).toEqual(['approved']);
  });

  it('receives while goods are on the road, including after a partial receipt', () => {
    expect(statusesWhere(canReceive)).toEqual(['in_transit', 'partially_received']);
  });

  it('closes received transfers only; discrepancies close them on the last resolution', () => {
    expect(statusesWhere(canClose)).toEqual(['received']);
    expect(statusesWhere(canResolveDiscrepancies)).toEqual(['discrepancy_pending']);
  });

  it('cancels before shipping only', () => {
    expect(statusesWhere(canCancel)).toEqual(['draft', 'approved']);
  });

  it('combines the state machine with RBAC: approve and close need the manager permission', () => {
    const operator = (permission: string) => permission === LOGISTICS_PERMISSIONS.transfers;
    const manager = () => true;

    expect(availableActions({ status: 'draft' }, operator)).toEqual(['cancel']);
    expect(availableActions({ status: 'draft' }, manager)).toEqual(['approve', 'cancel']);
    expect(availableActions({ status: 'approved' }, operator)).toEqual(['ship', 'cancel']);
    expect(availableActions({ status: 'received' }, operator)).toEqual([]);
    expect(availableActions({ status: 'received' }, manager)).toEqual(['close']);
    expect(availableActions({ status: 'discrepancy_pending' }, operator)).toEqual([]);
    expect(availableActions({ status: 'discrepancy_pending' }, manager)).toEqual(['resolve']);
    expect(availableActions({ status: 'partially_received' }, operator)).toEqual(['receive']);
    expect(availableActions({ status: 'closed' }, manager)).toEqual([]);
    expect(availableActions({ status: 'cancelled' }, manager)).toEqual([]);
  });
});

describe('step tracker', () => {
  it('walks Draft -> Approved -> Shipped -> Received -> Closed', () => {
    expect(trackerState('draft').current).toBe(0);
    expect(trackerState('approved').current).toBe(1);
    expect(trackerState('in_transit').current).toBe(2);
    expect(trackerState('received')).toMatchObject({ current: 4, status: 'process' });
    expect(trackerState('closed')).toMatchObject({ current: 4, status: 'finish' });
  });

  it('flags partial receipts and discrepancies on the receipt step', () => {
    expect(trackerState('partially_received')).toMatchObject({
      current: 3,
      status: 'process',
      partial: true,
    });
    expect(trackerState('discrepancy_pending')).toMatchObject({ current: 3, status: 'error' });
  });

  it('marks cancelled transfers as an error on the first step', () => {
    expect(trackerState('cancelled')).toMatchObject({
      current: 0,
      status: 'error',
      cancelled: true,
    });
  });
});

describe('list filters', () => {
  it('maps movement types onto API params and clears the other kind', () => {
    expect(movementTypeParams('inter_warehouse')).toEqual({
      purpose: 'inter_warehouse',
      is_inter_company: undefined,
    });
    expect(movementTypeParams('inter_company')).toEqual({
      purpose: undefined,
      is_inter_company: 1,
    });
    expect(movementTypeParams(null)).toEqual({ purpose: undefined, is_inter_company: undefined });
  });

  it('reads the movement type back from the params', () => {
    expect(movementTypeFromParams({ purpose: 'subcontracting' })).toBe('subcontracting');
    expect(movementTypeFromParams({ is_inter_company: 1 })).toBe('inter_company');
    expect(movementTypeFromParams({ purpose: 'technician_van' })).toBeNull();
    expect(movementTypeFromParams({})).toBeNull();
  });

  it('In Transit also covers partially received transfers', () => {
    expect(statusFilterParam('in_transit')).toBe('in_transit,partially_received');
    expect(statusFilterParam('discrepancy')).toBe('discrepancy_pending');
    expect(statusFilterParam(null)).toBeUndefined();
    expect(statusFilterFromParam('in_transit,partially_received')).toBe('in_transit');
    expect(statusFilterFromParam('unknown')).toBeNull();
  });
});

describe('fiscal data derived from the purpose', () => {
  it('picks the transport reason and DDT type like the API does', () => {
    expect(transportReasonForPurpose('inter_warehouse')).toBe('internal_transfer');
    expect(transportReasonForPurpose('inter_company')).toBe('internal_transfer');
    expect(transportReasonForPurpose('customer_consignment')).toBe('consignment_delivery');
    expect(transportReasonForPurpose('consignment_return')).toBe('consignment_return');
    expect(transportReasonForPurpose('subcontracting')).toBe('subcontracting');
    expect(transportReasonForPurpose('subcontracting_return')).toBe('subcontractor_return');
    expect(ddtTypeForPurpose('subcontracting')).toBe('subcontracting_out');
    expect(ddtTypeForPurpose('consignment_return')).toBe('customer_consignment_return');
  });

  it('prints prices on the DDT only when a third party is involved', () => {
    expect(ddtShowsPrices('inter_warehouse')).toBe(false);
    expect(ddtShowsPrices('technician_van')).toBe(false);
    expect(ddtShowsPrices('inter_company')).toBe(true);
    expect(ddtShowsPrices('customer_consignment')).toBe(true);
  });

  it('drafts an invoice for inter-company shipments', () => {
    const base: Pick<StockTransferResource, 'is_inter_company' | 'purpose'> = {
      is_inter_company: false,
      purpose: 'inter_warehouse',
    };
    expect(draftsInterCompanyInvoice(base)).toBe(false);
    expect(draftsInterCompanyInvoice({ ...base, is_inter_company: true })).toBe(true);
    expect(draftsInterCompanyInvoice({ ...base, purpose: 'inter_company' })).toBe(true);
  });
});

describe('receipt variance', () => {
  it('parses decimal strings from the API', () => {
    expect(toQty('3.5000')).toBe(3.5);
    expect(toQty(null)).toBe(0);
    expect(toQty('abc')).toBe(0);
  });

  it('computes outstanding as shipped - received - damaged', () => {
    expect(outstandingQty(line(10))).toBe(10);
    expect(outstandingQty(line(10, 4, 1))).toBe(5);
    expect(outstandingQty(line(10, 10))).toBe(0);
    expect(outstandingQty({ id: 'x', shipped_qty: '10.0000', received_qty: '2.5000' })).toBe(7.5);
  });

  it('defaults to receiving everything outstanding', () => {
    expect(defaultReceiptInput(line(10, 4))).toEqual({ good: 6, damaged: 0, reason: '' });
  });

  it('turns a short final receipt into a shortage', () => {
    const v = computeVariance(line(10), input(7, 1), true);
    expect(v).toMatchObject({ outstanding: 10, good: 7, damaged: 1, remaining: 2, shortage: 2 });
    expect(v.hasVariance).toBe(true);
  });

  it('keeps the remainder in transit on a partial receipt: no shortage', () => {
    const v = computeVariance(line(10), input(4), false);
    expect(v).toMatchObject({ remaining: 6, shortage: 0, hasVariance: false });
  });

  it('flags damaged units as a variance even on a partial receipt', () => {
    expect(computeVariance(line(10), input(4, 1), false).hasVariance).toBe(true);
  });

  it('accepts a complete clean receipt without a reason', () => {
    expect(validateReceiptLine(line(10), input(10), true)).toEqual([]);
  });

  it('rejects good + damaged above the outstanding quantity', () => {
    expect(validateReceiptLine(line(10, 4), input(5, 2), true)).toContain('EXCEEDS_OUTSTANDING');
    expect(validateReceiptLine(line(10, 4), input(6), true)).toEqual([]);
    expect(validateReceiptLine(line(10, 4), input(4, 2, 'crushed'), true)).toEqual([]);
  });

  it('rejects negative quantities', () => {
    expect(validateReceiptLine(line(10), input(-1), true)).toContain('NEGATIVE');
    expect(validateReceiptLine(line(10), input(5, -1), true)).toContain('NEGATIVE');
  });

  it('requires a reason when units are damaged or missing on a final receipt', () => {
    expect(validateReceiptLine(line(10), input(8), true)).toEqual(['REASON_REQUIRED']);
    expect(validateReceiptLine(line(10), input(8, 0, 'lost by carrier'), true)).toEqual([]);
    expect(validateReceiptLine(line(10), input(9, 1), false)).toEqual(['REASON_REQUIRED']);
    expect(validateReceiptLine(line(10), input(8), false)).toEqual([]);
    expect(validateReceiptLine(line(10), input(8, 0, '   '), true)).toEqual(['REASON_REQUIRED']);
  });

  it('validates the whole receipt and reports discrepancies', () => {
    const lines = [line(10, 0, 0, 'a'), line(5, 0, 0, 'b')];
    const ok = validateReceipt(lines, { a: input(10), b: input(4, 0, 'one missing') }, true);
    expect(ok).toMatchObject({ valid: true, hasDiscrepancy: true, nothingReceived: false });

    const bad = validateReceipt(lines, { a: input(11), b: input(5) }, true);
    expect(bad.valid).toBe(false);
    expect(bad.lineIssues['a']).toEqual(['EXCEEDS_OUTSTANDING']);
    expect(bad.lineIssues['b']).toBeUndefined();
  });

  it('defaults untouched lines to a full clean receipt', () => {
    expect(validateReceipt([line(3)], {}, true)).toMatchObject({
      valid: true,
      hasDiscrepancy: false,
    });
  });

  it('requires a partial receipt to book at least one unit', () => {
    const lines = [line(10)];
    expect(validateReceipt(lines, { l1: input(0) }, false)).toMatchObject({
      valid: false,
      nothingReceived: true,
    });
    expect(validateReceipt(lines, { l1: input(0, 1, 'broken') }, false).valid).toBe(true);
    expect(validateReceipt(lines, { l1: input(1) }, false).valid).toBe(true);
  });

  it('builds a payload that names every open line so none is received by default', () => {
    const lines = [line(10, 0, 0, 'a'), line(5, 0, 0, 'b'), line(3, 3, 0, 'done')];
    const payload = buildReceivePayload(lines, { a: input(4), b: input(0, 1, ' cracked ') }, false);

    expect(payload.final).toBe(false);
    expect(payload.lines).toEqual([
      { line_id: 'a', received_qty: 4, damaged_qty: 0, discrepancy_reason: null },
      { line_id: 'b', received_qty: 0, damaged_qty: 1, discrepancy_reason: 'cracked' },
    ]);
  });
});

describe('consignment declaration', () => {
  it('computes net, VAT and gross per line with cent rounding', () => {
    const totals = declarationTotals([
      { quantity: 3, unit_price: 10.5, tax_rate: 22 },
      { quantity: 2, unit_price: 4.99, tax_rate: 10 },
    ]);
    expect(totals.lines).toEqual([
      { net: 31.5, tax: 6.93, gross: 38.43 },
      { net: 9.98, tax: 1, gross: 10.98 },
    ]);
    expect(totals.net).toBe(41.48);
    expect(totals.tax).toBe(7.93);
    expect(totals.gross).toBe(49.41);
  });

  it('breaks the amounts down by VAT rate, sorted ascending', () => {
    const totals = declarationTotals([
      { quantity: 1, unit_price: 100, tax_rate: 22 },
      { quantity: 1, unit_price: 50, tax_rate: 4 },
      { quantity: 2, unit_price: 50, tax_rate: 22 },
    ]);
    expect(totals.byRate).toEqual([
      { rate: 4, net: 50, tax: 2 },
      { rate: 22, net: 200, tax: 44 },
    ]);
  });

  it('totals nothing for an empty declaration and ignores negative inputs', () => {
    expect(declarationTotals([])).toMatchObject({ net: 0, tax: 0, gross: 0, byRate: [] });
    expect(declarationTotals([{ quantity: -2, unit_price: 5, tax_rate: 22 }]).gross).toBe(0);
  });

  it('validates a declared quantity against the residual held by the third party', () => {
    expect(validateDeclarationLine(5, 10)).toEqual([]);
    expect(validateDeclarationLine(10, 10)).toEqual([]);
    expect(validateDeclarationLine(11, 10)).toEqual(['EXCEEDS_RESIDUAL']);
    expect(validateDeclarationLine(0, 10)).toEqual(['NOT_POSITIVE']);
  });

  it('generates a sales invoice for customers and a purchase order for vendors', () => {
    expect(generatedDocumentKind('customer')).toBe('sales_invoice');
    expect(generatedDocumentKind('vendor')).toBe('purchase_order');
    expect(directionForWarehouseType('customer_consignment')).toBe('customer');
    expect(directionForWarehouseType('vendor_consignment')).toBe('vendor');
    expect(directionForWarehouseType('subcontractor')).toBeNull();
  });
});

describe('warehouse routing per purpose', () => {
  const wh = (warehouse_type: string, extra: Partial<RoutedWarehouse> = {}): RoutedWarehouse => ({
    warehouse_type,
    legal_owner_type: 'company',
    company_entity_id: 'e1',
    linked_partner_id: null,
    ...extra,
  });

  it('only ships from our own non-virtual warehouses', () => {
    expect(isValidOrigin('inter_warehouse', wh('standard'))).toBe(true);
    expect(isValidOrigin('inter_warehouse', wh('transit'))).toBe(false);
    expect(
      isValidOrigin('inter_warehouse', wh('vendor_consignment', { legal_owner_type: 'vendor' })),
    ).toBe(false);
  });

  it('returns start from the third party that holds our goods', () => {
    expect(isValidOrigin('consignment_return', wh('customer_consignment'))).toBe(true);
    expect(isValidOrigin('consignment_return', wh('standard'))).toBe(false);
    expect(isValidOrigin('subcontracting_return', wh('subcontractor'))).toBe(true);
  });

  it('forces the destination type of consignment, subcontracting and van transfers', () => {
    expect(isValidDestination('customer_consignment', wh('customer_consignment'))).toBe(true);
    expect(isValidDestination('customer_consignment', wh('standard'))).toBe(false);
    expect(isValidDestination('subcontracting', wh('subcontractor'))).toBe(true);
    expect(isValidDestination('technician_van', wh('mobile_van'))).toBe(true);
    expect(isValidDestination('technician_van', wh('standard'))).toBe(false);
  });

  it('rejects virtual and vendor warehouses between own warehouses; returns land on own premises', () => {
    expect(isValidDestination('inter_warehouse', wh('standard'))).toBe(true);
    expect(isValidDestination('inter_warehouse', wh('transit'))).toBe(false);
    expect(isValidDestination('inter_warehouse', wh('vendor_consignment'))).toBe(false);
    expect(isValidDestination('consignment_return', wh('standard'))).toBe(true);
    expect(isValidDestination('consignment_return', wh('subcontractor'))).toBe(false);
  });

  it('requires a different legal entity with a linked partner for inter-company', () => {
    const origin = wh('standard', { company_entity_id: 'e1' });
    const other = wh('standard', { company_entity_id: 'e2', linked_partner_id: 'p1' });
    expect(isValidDestination('inter_company', other, origin)).toBe(true);
    expect(
      isValidDestination(
        'inter_company',
        wh('standard', { company_entity_id: 'e1', linked_partner_id: 'p1' }),
        origin,
      ),
    ).toBe(false);
    expect(
      isValidDestination('inter_company', wh('standard', { company_entity_id: 'e2' }), origin),
    ).toBe(false);
  });
});

describe('dispatch payload', () => {
  const form: ShipFormValue = {
    transport_by: 'carrier',
    carrier_name: ' DHL ',
    carrier_license_plate: '',
    carriage_terms: 'free',
    goods_appearance: 'Cartons',
    packages_count: 3.9,
    gross_weight_kg: 12.5,
  };

  it('trims text, drops blanks and truncates the package count', () => {
    expect(buildShipPayload(form)).toEqual({
      transport_by: 'carrier',
      carriage_terms: 'free',
      carrier_name: 'DHL',
      goods_appearance: 'Cartons',
      packages_count: 3,
      gross_weight_kg: 12.5,
    });
  });

  it('does not send a carrier when the sender or recipient transports', () => {
    const payload = buildShipPayload({ ...form, transport_by: 'sender', packages_count: null });
    expect(payload.carrier_name).toBeUndefined();
    expect(payload.packages_count).toBeUndefined();
    expect(carrierRequired('sender')).toBe(false);
    expect(carrierRequired('carrier')).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('formats the local calendar date without timezone shifts', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('valuation breakdown', () => {
  const valuation: InventoryValuation = {
    total_balance_sheet_value: 1000,
    excluded_third_party_value: 250,
    by_warehouse_type: {},
    buckets: {
      owned_on_hand: 500,
      owned_in_transit: 100,
      owned_at_customer_consignment: 250,
      owned_at_subcontractor: 150,
      third_party_vendor_consignment_held: 250,
    },
  };

  it('separates owned stock from third-party consignment stock', () => {
    const b = valuationBreakdown(valuation);
    expect(b.ownedTotal).toBe(1000);
    expect(b.ownedTotal).toBe(valuation.total_balance_sheet_value);
    expect(b.thirdParty.value).toBe(250);
    expect(b.physicalTotal).toBe(1250);
    expect(b.owned.map((r) => r.key)).toEqual([
      'owned_on_hand',
      'owned_in_transit',
      'owned_at_customer_consignment',
      'owned_at_subcontractor',
    ]);
  });

  it('computes the share of each owned bucket', () => {
    const shares = valuationBreakdown(valuation).owned.map((r) => r.share);
    expect(shares).toEqual([50, 10, 25, 15]);
  });

  it('copes with an empty or legacy valuation without buckets', () => {
    const b = valuationBreakdown({
      total_balance_sheet_value: 0,
      excluded_third_party_value: 0,
      by_warehouse_type: {},
    });
    expect(b.ownedTotal).toBe(0);
    expect(b.owned.every((r) => r.value === 0 && r.share === 0)).toBe(true);
    expect(b.physicalTotal).toBe(0);
  });
});
