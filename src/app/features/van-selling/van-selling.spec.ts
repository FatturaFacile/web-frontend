import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  CustomerFieldDossier,
  FieldRoutePlan,
  Gs1ParseResult,
  OfflineSyncBatchResult,
  ReplenishmentSuggestion,
  ThermalPrintJob,
  VanEodSettlement,
  VanEodSettlementPreview,
  VanLoadManifest,
  VanSellingApiService,
  VanSellingConfig,
  VanVisitOutcome,
  VanWarehouse,
} from '@core';
import { VanSellingCockpitComponent } from './van-selling-cockpit.component';

const sampleConfig: VanSellingConfig = {
  ui_copy: {
    page_title: 'Van Selling & Field Sales',
    page_subtitle: 'Subtitle',
    tab_vans: 'Vans',
    tab_manifests: 'Manifests',
    tab_routes: 'Routes',
    tab_sync_print: 'Sync & Print',
    tab_eod: 'EOD Settlement',
    new_van: 'New Van',
    license_plate: 'Plate',
    van_code: 'Code',
    van_name: 'Name',
    driver_name: 'Driver',
    cold_chain: 'Cold Chain',
    current_temp: 'Temp',
    record_temp: 'Record Temp',
    invoice_sectional: 'Inv Sectional',
    ddt_sectional: 'DDT Sectional',
    receipt_sectional: 'RT Sectional',
    reserve_offline_batch: 'Reserve Batch',
    load_suggestions: 'Suggestions',
    create_manifest: 'Create Manifest',
    issue_global_ddt: 'Issue Global DDT',
    global_ddt_badge: 'Global DDT',
    select_route: 'Route',
    select_customer: 'Customer',
    fast_reorder_title: 'Fast Reorder',
    apply_fast_reorder: 'Apply Fast Reorder',
    gs1_barcode_label: 'GS1-128',
    parse_gs1: 'Parse GS1',
    credit_blocked_alert: 'Credit Blocked',
    unblock_credit_btn: 'Unblock Credit',
    credit_ok_badge: 'Credit OK',
    submit_visit: 'Submit Visit',
    queue_offline: 'Queue Offline',
    run_offline_sync: 'Run Sync',
    thermal_preview: 'Thermal Preview',
    eod_preview: 'EOD Preview',
    eod_complete: 'Complete EOD',
    keep_onboard: 'Keep Onboard',
    unload_central: 'Unload Central',
    deposit_slip: 'Deposit Slip',
    opening_float: 'Opening Float',
    counted_cash: 'Counted Cash',
    total_remittance: 'Total Remittance',
  },
  regulatory: {
    it_ddt_notice: 'DPR 472/1996',
    offline_sectional_notice: 'Dedicated sectionals',
  },
  van_statuses: [{ code: 'active', label: 'Active' }],
  manifest_statuses: [{ code: 'planned', label: 'Planned' }],
  visit_modes: [
    { code: 'van_selling', label: 'Van Selling' },
    { code: 'field_presale', label: 'Field Pre-Sale' },
  ],
  visit_outcomes: [{ code: 'completed_sale', label: 'Completed Sale' }],
  settlement_statuses: [{ code: 'reconciled', label: 'Reconciled' }],
  document_types: [{ code: 'immediate_invoice', label: 'Immediate Invoice' }],
  payment_methods: [
    { code: 'cash', label: 'Cash' },
    { code: 'twint', label: 'TWINT' },
  ],
  printer_profiles: [{ code: 'escpos_80mm', label: 'ESC/POS 80mm' }],
  no_sale_reasons: [{ code: 'closed_shop', label: 'Closed' }],
  empties_catalog: [{ item_code: 'EMP-CASSA-151', item_name: 'Crate Mod 151', unit_deposit: 12 }],
  sample_gs1_barcodes: ['(01)08001234567893(3103)002450(10)LOT-CH2611(17)261231'],
};

const sampleVan: VanWarehouse = {
  id: 'van-1',
  code: 'MI01',
  name: 'Furgone Milano',
  license_plate: 'MI-94821-FS',
  vehicle_make_model: 'Iveco Daily',
  warehouse_id: 'wh-van-1',
  depot_warehouse_id: 'wh-main',
  driver_user_id: null,
  driver_name: 'Marco Bellini',
  has_cold_chain: true,
  min_temp_celsius: '0.00',
  max_temp_celsius: '4.00',
  current_temp_celsius: '2.40',
  last_temp_recorded_at: '2026-11-25T08:00:00Z',
  temp_alert_active: false,
  invoice_sectional_code: 'FV-MI01',
  invoice_next_number: 1,
  ddt_sectional_code: 'DDTV-MI01',
  ddt_next_number: 1,
  receipt_sectional_code: 'RTV-MI01',
  receipt_next_number: 1,
  fiscal_year: 2026,
  printer_profile: 'escpos_80mm',
  printer_brand: 'Bixolon',
  printer_mac_address: null,
  status: 'active',
  current_stock_snapshot: [],
  empties_onboard_snapshot: [],
  temperature_log: [],
  sync_version: 1,
  last_synced_at: null,
  notes: null,
  created_at: '2026-11-25T08:00:00Z',
};

const sampleManifest: VanLoadManifest = {
  id: 'man-1',
  van_warehouse_id: 'van-1',
  van_license_plate: 'MI-94821-FS',
  manifest_number: 'VLM-2026-001',
  load_date: '2026-11-25',
  weekday_iso: 3,
  route_code: 'GIRO-MI',
  global_ddt_id: null,
  global_ddt_number: null,
  global_ddt_causal: 'Tentata Vendita',
  regulatory_reference: 'DPR 472/1996 & CM 249/E',
  self_addressed_company_name: 'VanFood Srl',
  departure_temp_celsius: '2.40',
  cold_chain_compliant: true,
  status: 'planned',
  lines: [{ product_id: 'prod-1', quantity: 20 }],
  replenishment_suggestions: [],
  total_packages: 2,
  total_gross_weight_kg: '20.000',
  total_net_value: '500.00',
  currency: 'EUR',
  dispatched_at: null,
};

const sampleRoute: FieldRoutePlan = {
  id: 'route-1',
  van_warehouse_id: 'van-1',
  van_load_manifest_id: 'man-1',
  route_code: 'GIRO-MI',
  name: 'Giro Milano',
  plan_date: '2026-11-25',
  weekday_iso: 3,
  is_recurring: true,
  salesperson_name: 'Marco Bellini',
  territory_zone: 'Milano',
  country: 'IT',
  status: 'active',
  stops: [{ sequence: 1, contact_id: 'con-1', customer_name: 'Bottega Alpina' }],
  total_stops: 1,
  completed_stops: 0,
  sync_version: 1,
};

const sampleDossier: CustomerFieldDossier = {
  contact: { id: 'con-1', name: 'Bottega Alpina', country: 'IT', vat_number: 'IT123', uid_number: null, sdi_code: 'M5UXCR1' },
  credit: {
    credit_limit: 5000,
    open_exposure: 1200,
    overdue_amount: 104,
    overdue_invoices: [{ invoice_id: 'inv-1', invoice_number: 'INV-001', date: '2026-10-01', due_date: '2026-10-31', total_gross: 104, total_paid: 0, remaining_due: 104, currency: 'EUR' }],
    is_blocked: true,
    block_reason: 'overdue_invoices_present',
    can_unblock_by_collection: true,
  },
  fast_reorder_last_5: [
    { product_id: 'prod-1', sku: 'FORM-DOP', description: 'Formaggio DOP', unit_measure: 'kg', suggested_quantity: 5, last_unit_price: 25, tax_rate: 4, purchase_frequency_last_5: 3 },
  ],
};

const sampleGs1: Gs1ParseResult = {
  raw_barcode: '(01)08001234567893(3103)002450(10)LOT-CH2611(17)261231',
  format: 'GS1-128',
  gtin: '08001234567893',
  sku_candidate: '8001234567893',
  net_weight_kg: 2.45,
  variable_price_amount: null,
  lot_number: 'LOT-CH2611',
  expiry_date: '2026-12-31',
  matched_product_id: 'prod-1',
  matched_product_sku: 'FORM-DOP',
  matched_product_name: 'Formaggio DOP',
  unit_price: 25,
  computed_line_total: 61.25,
};

const sampleVisit: VanVisitOutcome = {
  id: 'vis-1',
  field_route_plan_id: 'route-1',
  van_warehouse_id: 'van-1',
  contact_id: 'con-1',
  customer_name: 'Bottega Alpina',
  stop_sequence: 1,
  visit_mode: 'van_selling',
  outcome_status: 'completed_sale',
  no_sale_reason_code: null,
  document_type: 'immediate_invoice',
  fiscal_sectional_code: 'FV-MI01',
  definitive_document_number: 'FV-MI01/2026/00001',
  sdi_transmission_status: 'queued_for_sdi',
  qr_bill_generated: false,
  qr_bill_reference: null,
  credit_check_passed: true,
  credit_limit_amount: '5000.00',
  exposure_before_visit: '0.00',
  overdue_amount_before_visit: '0.00',
  sale_lines: [],
  empties_movements: [],
  total_net: '61.25',
  total_tax: '2.45',
  total_gross: '63.70',
  empties_net_deposit_amount: '0.00',
  total_collected_amount: '63.70',
  payment_method: 'cash',
  currency: 'EUR',
  printer_format: 'escpos_80mm',
  client_idempotency_key: 'KEY-1',
  synced_at: '2026-11-25T10:00:00Z',
  visited_at: '2026-11-25T10:00:00Z',
};

const samplePrint: ThermalPrintJob = {
  profile: 'escpos_80mm',
  printer_brand: 'Bixolon',
  paper_width_mm: '80mm',
  document_number: 'FV-MI01/2026/00001',
  escpos_commands: '\\x1B\\x40',
  zpl_commands: '^XA^FO30,40^FDTest^FS^XZ',
  human_preview: 'DOC: FV-MI01/2026/00001',
};

const sampleSync: OfflineSyncBatchResult = {
  van_warehouse_id: 'van-1',
  server_sync_version: 2,
  version_drift_detected: false,
  encryption_algorithm: 'AES-256-GCM',
  synced_at: '2026-11-25T12:00:00Z',
  processed_count: 1,
  conflict_count: 0,
  processed_visits: [{ visit_id: 'vis-1', client_idempotency_key: 'KEY-1', outcome_status: 'completed_sale', definitive_document_number: 'FV-MI01/2026/00001', sdi_transmission_status: 'queued_for_sdi', qr_bill_reference: null }],
  conflicts: [],
};

const samplePreview: VanEodSettlementPreview = {
  van_warehouse_id: 'van-1',
  van_license_plate: 'MI-94821-FS',
  van_load_manifest_id: 'man-1',
  settlement_date: '2026-11-25',
  stock_reconciliation_lines: [
    { product_id: 'prod-1', sku: 'FORM-DOP', description: 'Formaggio DOP', lot_number: 'LOT-A', unit_measure: 'kg', loaded_qty: 20, sold_qty: 5, freebies_qty: 0, returned_damaged_qty: 0, remaining_qty: 15, keep_onboard_qty: 15, unload_central_qty: 0 },
  ],
  empties_reconciliation: [],
  cold_chain_summary: { has_cold_chain: true, readings_count: 2, min_recorded_celsius: 2.1, max_recorded_celsius: 2.4, alert_triggered: false },
  collections_summary: { collected_cash_amount: 63.7, collected_pos_card_amount: 0, collected_twint_amount: 0, collected_cheque_amount: 0, collected_bank_transfer_amount: 0 },
};

const sampleSettlement: VanEodSettlement = {
  id: 'eod-1',
  van_warehouse_id: 'van-1',
  van_license_plate: 'MI-94821-FS',
  settlement_number: 'EOD-MI01-001',
  settlement_date: '2026-11-25',
  status: 'reconciled',
  stock_reconciliation_lines: samplePreview.stock_reconciliation_lines,
  total_loaded_qty: '20.0000',
  total_sold_qty: '5.0000',
  total_remaining_qty: '15.0000',
  total_keep_onboard_qty: '10.0000',
  total_unload_central_qty: '5.0000',
  opening_cash_float: '150.00',
  collected_cash_amount: '63.70',
  collected_pos_card_amount: '0.00',
  collected_twint_amount: '0.00',
  collected_cheque_amount: '0.00',
  expected_cash_remittance: '213.70',
  counted_cash_remittance: '213.70',
  cash_discrepancy_amount: '0.00',
  total_remittance_amount: '213.70',
  deposit_slip_number: 'VERS-2026-001',
  treasury_deposited: true,
  central_warehouse_unloaded: true,
  currency: 'EUR',
  reconciled_at: '2026-11-25T18:00:00Z',
};

describe('VanSellingCockpitComponent (Mod 233)', () => {
  const api = {
    getConfig: vi.fn(),
    getVans: vi.fn(),
    createVan: vi.fn(),
    recordTemperature: vi.fn(),
    reserveSectionalBatch: vi.fn(),
    getLoadManifests: vi.fn(),
    getReplenishmentSuggestions: vi.fn(),
    createLoadManifest: vi.fn(),
    issueGlobalDdt: vi.fn(),
    getRoutePlans: vi.fn(),
    getCustomerFieldDossier: vi.fn(),
    unblockCustomerCredit: vi.fn(),
    parseGs1Barcode: vi.fn(),
    getVisits: vi.fn(),
    recordVisit: vi.fn(),
    getThermalPrint: vi.fn(),
    syncOfflineBatch: vi.fn(),
    getSettlements: vi.fn(),
    previewSettlement: vi.fn(),
    completeSettlement: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getConfig.mockReturnValue(of({ data: sampleConfig }));
    api.getVans.mockReturnValue(of({ data: [sampleVan] }));
    api.createVan.mockReturnValue(of({ data: sampleVan }));
    api.recordTemperature.mockReturnValue(of({ data: { ...sampleVan, current_temp_celsius: '3.10' } }));
    api.reserveSectionalBatch.mockReturnValue(of({ data: { sectional_code: 'FV-MI01', fiscal_year: 2026, range_start: 1, range_end: 25, reserved_numbers: ['FV-MI01/2026/00001'] } }));
    api.getLoadManifests.mockReturnValue(of({ data: [sampleManifest] }));
    api.getReplenishmentSuggestions.mockReturnValue(of({ data: [{ product_id: 'prod-1', sku: 'FORM-DOP', name: 'Formaggio DOP', unit_measure: 'kg', historical_weekday_avg_qty: 20, current_onboard_qty: 0, suggested_load_qty: 20, unit_price: 25, basis: 'weekday_3' } satisfies ReplenishmentSuggestion] }));
    api.createLoadManifest.mockReturnValue(of({ data: sampleManifest }));
    api.issueGlobalDdt.mockReturnValue(of({ data: { ...sampleManifest, status: 'ddt_issued', global_ddt_number: 'DDTV-MI01/2026/00001' } }));
    api.getRoutePlans.mockReturnValue(of({ data: [sampleRoute] }));
    api.getCustomerFieldDossier.mockReturnValue(of({ data: sampleDossier }));
    api.unblockCustomerCredit.mockReturnValue(of({ data: { payment_id: 'pay-1', unblocked: true, credit: { ...sampleDossier.credit, is_blocked: false, overdue_amount: 0 } } }));
    api.parseGs1Barcode.mockReturnValue(of({ data: sampleGs1 }));
    api.getVisits.mockReturnValue(of({ data: [sampleVisit] }));
    api.recordVisit.mockReturnValue(of({ data: sampleVisit }));
    api.getThermalPrint.mockReturnValue(of({ data: samplePrint }));
    api.syncOfflineBatch.mockReturnValue(of({ data: sampleSync }));
    api.getSettlements.mockReturnValue(of({ data: [sampleSettlement] }));
    api.previewSettlement.mockReturnValue(of({ data: samplePreview }));
    api.completeSettlement.mockReturnValue(of({ data: sampleSettlement }));

    TestBed.configureTestingModule({
      imports: [VanSellingCockpitComponent],
      providers: [
        provideRouter([]),
        { provide: VanSellingApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } },
        provideNzIcons(icons),
      ],
    });
  });

  it('loads API-seeded config, issues Global DDT, parses GS1-128, unblocks credit, syncs offline, and completes EOD settlement', async () => {
    const fixture = TestBed.createComponent(VanSellingCockpitComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const cmp = fixture.componentInstance;
    expect(api.getConfig).toHaveBeenCalled();

    await cmp.loadSuggestions();
    await cmp.createManifestFromSuggestions();
    await cmp.issueGlobalDdt('man-1');
    expect(api.issueGlobalDdt).toHaveBeenCalledWith('man-1');

    await cmp.selectStopCustomer('con-1', 1);
    expect(api.getCustomerFieldDossier).toHaveBeenCalledWith('con-1', 0);

    await cmp.confirmUnblockCredit();
    expect(api.unblockCustomerCredit).toHaveBeenCalledWith('con-1', expect.objectContaining({ invoice_id: 'inv-1' }));

    await cmp.parseGs1();
    expect(cmp.draftLines().length).toBe(1);
    expect(cmp.draftLines()[0].quantity).toBe(2.45);

    await cmp.submitVisit(true);
    await cmp.runOfflineSync();
    expect(api.syncOfflineBatch).toHaveBeenCalled();

    await cmp.openThermalPrint(sampleVisit);
    expect(cmp.printModalVisible()).toBe(true);

    await cmp.previewEod();
    cmp.updateEodSplit(0, 10);
    expect(cmp.eodLines()[0].unload_central_qty).toBe(5);
    await cmp.completeEod();
    expect(api.completeSettlement).toHaveBeenCalled();
  });
});
