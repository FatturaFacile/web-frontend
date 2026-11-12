import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  ClientApiService,
  ConstructionApiService,
  ConstructionProgressBilling,
  ConstructionSite,
  TradesBid,
  TradesBidPosition,
  TradesBilling,
  TradesBudgetControl,
  TradesSiteDiaryEntry,
  TradesSiteDocument,
  TradesSubcontract,
  TradesSubcontractor,
} from '@core';
import { ConstructionComponent } from './construction.component';

describe('ConstructionComponent', () => {
  let fixture: ComponentFixture<ConstructionComponent>;
  let component: ConstructionComponent;

  const mockSite: ConstructionSite = {
    id: 'site-1-uuid',
    code: 'CANTIERE-001',
    name: 'Residenza Bellavista',
    client_id: 'contact-1',
    address: 'Lugano Centro',
  };

  const mockSal: ConstructionProgressBilling = {
    id: 'sal-1-uuid',
    construction_site_id: 'site-1-uuid',
    sal_number: 'SAL 1',
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    gross_certified_amount: 150000,
    retention_percentage: 10,
    net_amount: 135000,
    status: 'certified',
  };

  const mockBid: TradesBid = {
    id: 'bid-1-uuid',
    bid_number: 'APP-2026-001',
    title: 'Opere da Muratore e Cemento Armato',
    construction_site_id: 'site-1-uuid',
    contact_id: 'contact-1',
    language: 'it',
    currency: 'CHF',
    tax_rate: '8.10',
    status: 'submitted',
  };

  const mockPosition: TradesBidPosition = {
    id: 'pos-1-uuid',
    bid_id: 'bid-1-uuid',
    position_code: '01.02.03',
    description: 'Getto calcestruzzo C25/30',
    unit: 'm³',
    quantity: '120',
    unit_price: '210.00',
    total: '25200.00',
  };

  const mockBidBilling: TradesBilling = {
    id: 'tb-1-uuid',
    bid_id: 'bid-1-uuid',
    kind: 'partial',
    basis: 'percentage',
    sequence: 1,
    billing_date: '2026-03-01',
    gross_this: '80000.00',
    retention_amount: '8000.00',
    amount_invoiced: '72000.00',
  };

  const mockBudgetControl: TradesBudgetControl = {
    bid_id: 'bid-1-uuid',
    planned_revenue: '450000.00',
    actual_revenue: '80000.00',
    planned_costs: '320000.00',
    actual_costs: '55000.00',
    margin_amount: '25000.00',
    margin_percentage: 31.25,
  };

  const mockDiary: TradesSiteDiaryEntry = {
    id: 'diary-1-uuid',
    construction_site_id: 'site-1-uuid',
    entry_date: '2026-03-02',
    weather: 'Sereno 18°C',
    workers_present: 8,
    work_performed: 'Armatura solaio e getto pilastri',
  };

  const mockDocument: TradesSiteDocument = {
    id: 'doc-1-uuid',
    construction_site_id: 'site-1-uuid',
    title: 'Piano Operativo di Sicurezza POS',
    kind: 'safety_plan',
    expires_on: '2026-12-31',
  };

  const mockSubcontractor: TradesSubcontractor = {
    id: 'sub-1-uuid',
    name: 'Edilizia Moderna Sagl',
    tax_id: 'CHE-999.888.777',
    trade: 'Opere di finitura',
  };

  const mockSubcontract: TradesSubcontract = {
    id: 'sc-1-uuid',
    construction_site_id: 'site-1-uuid',
    subcontractor_id: 'sub-1-uuid',
    description: 'Posa cartongessi e tinteggiatura',
    contract_amount: '35000.00',
    status: 'active',
  };

  const mockConstructionApi = {
    getSites: vi.fn().mockReturnValue(of({ data: [mockSite] })),
    createSite: vi.fn().mockReturnValue(of({ data: mockSite })),
    getProgressBillings: vi.fn().mockReturnValue(of({ data: [mockSal] })),
    createProgressBilling: vi.fn().mockReturnValue(of({ data: mockSal })),
    getBids: vi.fn().mockReturnValue(of({ data: [mockBid] })),
    getBid: vi.fn().mockReturnValue(of({ data: { ...mockBid, positions: [mockPosition] }, meta: { net_total: '25200.00' } })),
    createBid: vi.fn().mockReturnValue(of({ data: mockBid })),
    changeBidStatus: vi.fn().mockReturnValue(of({ data: { ...mockBid, status: 'accepted' } })),
    addBidPosition: vi.fn().mockReturnValue(of({ data: mockPosition })),
    recordMeasurement: vi.fn().mockReturnValue(of({ data: { id: 'm-1' } })),
    getBidBillings: vi.fn().mockReturnValue(of({ data: [mockBidBilling] })),
    issueBidBilling: vi.fn().mockReturnValue(of({ data: mockBidBilling })),
    getBudgetControl: vi.fn().mockReturnValue(of({ data: mockBudgetControl })),
    getSiteDiary: vi.fn().mockReturnValue(of({ data: [mockDiary] })),
    writeSiteDiary: vi.fn().mockReturnValue(of({ data: mockDiary })),
    getSiteDocuments: vi.fn().mockReturnValue(of({ data: [mockDocument] })),
    addSiteDocument: vi.fn().mockReturnValue(of({ data: mockDocument })),
    getExpiringDocuments: vi.fn().mockReturnValue(of({ data: [] })),
    getSubcontractors: vi.fn().mockReturnValue(of({ data: [mockSubcontractor] })),
    createSubcontractor: vi.fn().mockReturnValue(of({ data: mockSubcontractor })),
    getSiteSubcontracts: vi.fn().mockReturnValue(of({ data: [mockSubcontract] })),
    createSiteSubcontract: vi.fn().mockReturnValue(of({ data: mockSubcontract })),
    certifySubcontractWork: vi.fn().mockReturnValue(of({ data: mockSubcontract })),
  };

  const mockClientApi = {
    list: vi.fn().mockReturnValue(of({ data: [{ id: 'contact-1', company_name: 'Residenza Bellavista SA', first_name: null, last_name: null }] })),
  };

  const mockMessageService = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ConstructionComponent],
      providers: [
        provideNzIcons(icons),
        { provide: ConstructionApiService, useValue: mockConstructionApi },
        { provide: ClientApiService, useValue: mockClientApi },
        { provide: NzMessageService, useValue: mockMessageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConstructionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load sites, progress billings, bids, documents, and subcontractors', () => {
    expect(component).toBeTruthy();
    expect(mockConstructionApi.getSites).toHaveBeenCalled();
    expect(mockConstructionApi.getProgressBillings).toHaveBeenCalled();
    expect(mockConstructionApi.getBids).toHaveBeenCalled();
    expect(mockConstructionApi.getSiteDocuments).toHaveBeenCalled();
    expect(mockConstructionApi.getSubcontractors).toHaveBeenCalled();
    expect(component.sites().length).toBe(1);
    expect(component.bids().length).toBe(1);
    expect(component.subcontractors().length).toBe(1);
    expect(component.contactNameOf('contact-1')).toBe('Residenza Bellavista SA');
  });

  it('sends the site fields of the API and blocks an end date before the start', () => {
    component.openCreateSiteModal();
    component.siteForm.patchValue({
      code: 'CANTIERE-002',
      name: 'Casa Rossi',
      client_id: 'contact-1',
      address: 'Bellinzona',
      start_date: '2026-05-10',
      estimated_end_date: '2026-05-01',
    });
    component.saveSite();
    expect(mockConstructionApi.createSite).not.toHaveBeenCalled();
    expect(component.siteForm.controls.estimated_end_date.hasError('endsBeforeStart')).toBe(true);

    component.siteForm.patchValue({ estimated_end_date: '2026-11-30' });
    component.saveSite();
    expect(mockConstructionApi.createSite).toHaveBeenCalledWith({
      client_id: 'contact-1',
      code: 'CANTIERE-002',
      name: 'Casa Rossi',
      address: 'Bellinzona',
      sia_norm_reference: null,
      npk_code: null,
      start_date: '2026-05-10',
      estimated_end_date: '2026-11-30',
      status: 'planning',
    });
    expect(component.siteModalVisible()).toBe(false);
  });

  it('creates a SAL and requires the end of the period not before its start', () => {
    component.openCreateSalModal();
    component.salForm.patchValue({ construction_site_id: 'site-1-uuid', period_start: '2026-03-10', period_end: '2026-03-01' });
    component.saveSal();
    expect(mockConstructionApi.createProgressBilling).not.toHaveBeenCalled();
    expect(component.salForm.controls.period_end.hasError('endsBeforeStart')).toBe(true);

    component.salForm.patchValue({ period_end: '2026-03-31', sal_number: 'SAL 2', gross_certified_amount: 180000, retention_percentage: 10 });
    component.saveSal();
    expect(mockConstructionApi.createProgressBilling).toHaveBeenCalledWith({
      construction_site_id: 'site-1-uuid',
      sal_number: 'SAL 2',
      period_start: '2026-03-10',
      period_end: '2026-03-31',
      gross_certified_amount: 180000,
      retention_percentage: 10,
    });

    component.salForm.patchValue({ retention_percentage: 60 });
    expect(component.salForm.controls.retention_percentage.invalid).toBe(true);
  });

  it('should not call the API when the forms are submitted empty or with an invalid amount', () => {
    component.openCreateSiteModal();
    component.saveSite();
    expect(mockConstructionApi.createSite).not.toHaveBeenCalled();
    expect(component.siteForm.controls.code.touched).toBe(true);

    component.saveBid();
    expect(mockConstructionApi.createBid).not.toHaveBeenCalled();

    component.subcontractForm.patchValue({ site_id: 's1', subcontractor_id: 'x', description: 'Work', contract_amount: '0' });
    component.saveSubcontract();
    expect(component.subcontractForm.controls.contract_amount.hasError('positive')).toBe(true);
  });

  it('sends the bid fields of the API and accepts the bid', () => {
    component.openCreateBidModal();
    component.bidForm.patchValue({ title: 'Opere da Gessista', contact_id: 'contact-1', language: 'de', tax_rate: '8.10' });
    component.saveBid();
    expect(mockConstructionApi.createBid).toHaveBeenCalledWith({
      construction_site_id: 'site-1-uuid',
      contact_id: 'contact-1',
      title: 'Opere da Gessista',
      language: 'de',
      currency: 'CHF',
      tax_rate: '8.10',
      valid_until: null,
      notes: null,
    });
    expect(component.bidModalVisible()).toBe(false);

    component.changeBidStatus(mockBid, 'accepted');
    expect(mockConstructionApi.changeBidStatus).toHaveBeenCalledWith('bid-1-uuid', { status: 'accepted' });
  });

  it('sends position, measurement and billing with the fields of the API', () => {
    component.openBidDrawer(mockBid);
    expect(component.bidNetTotal()).toBe('25200.00');

    component.openAddPositionModal();
    component.positionForm.patchValue({ position_code: '02.01', description: 'Massetto', unit: 'm²', quantity: '300', unit_price: '35.00' });
    component.savePosition();
    expect(mockConstructionApi.addBidPosition).toHaveBeenCalledWith('bid-1-uuid', {
      position_code: '02.01',
      description: 'Massetto',
      unit: 'm²',
      quantity: '300',
      unit_price: '35.00',
    });

    component.openAddMeasurementModal('pos-1-uuid');
    component.measurementForm.patchValue({ measured_on: '2026-03-05', quantity: '80', note: 'Piano terra' });
    component.saveMeasurement();
    expect(mockConstructionApi.recordMeasurement).toHaveBeenCalledWith('bid-1-uuid', {
      bid_position_id: 'pos-1-uuid',
      measured_on: '2026-03-05',
      quantity: '80',
      note: 'Piano terra',
    });

    component.openIssueBidBillingModal(mockBid);
    component.bidBillingForm.patchValue({ kind: 'partial', basis: 'percentage', percentage: '', date: '2026-03-10' });
    component.saveBidBilling();
    expect(mockConstructionApi.issueBidBilling).not.toHaveBeenCalled();
    component.bidBillingForm.patchValue({ percentage: '30' });
    component.saveBidBilling();
    expect(mockConstructionApi.issueBidBilling).toHaveBeenCalledWith('bid-1-uuid', {
      kind: 'partial',
      basis: 'percentage',
      percentage: '30',
      date: '2026-03-10',
    });

    component.openIssueBidBillingModal(mockBid);
    component.bidBillingForm.patchValue({ kind: 'final' });
    component.saveBidBilling();
    expect(mockConstructionApi.issueBidBilling).toHaveBeenLastCalledWith('bid-1-uuid', {
      kind: 'final',
      basis: null,
      percentage: null,
      date: expect.any(String),
    });

    component.closeBidDrawer();
    expect(component.selectedBid()).toBeNull();
  });

  it('sends diary, document, subcontractor, subcontract and certification with the fields of the API', () => {
    component.openCreateDiaryModal();
    component.diaryForm.patchValue({ site_id: 'site-1-uuid', entry_date: '2026-03-02', work_performed: 'Posa pavimenti', weather: 'Soleggiato', workers_present: 8 });
    component.saveDiary();
    expect(mockConstructionApi.writeSiteDiary).toHaveBeenCalledWith('site-1-uuid', {
      entry_date: '2026-03-02',
      weather: 'Soleggiato',
      workers_present: 8,
      work_performed: 'Posa pavimenti',
      incidents: null,
    });

    component.openCreateDocumentModal();
    component.documentForm.patchValue({ site_id: 'site-1-uuid', title: 'DURC', kind: 'insurance', issued_on: '2026-03-10', expires_on: '2026-03-01' });
    component.saveDocument();
    expect(mockConstructionApi.addSiteDocument).not.toHaveBeenCalled();
    expect(component.documentForm.controls.expires_on.hasError('endsBeforeStart')).toBe(true);
    component.documentForm.patchValue({ expires_on: '2026-12-31' });
    component.saveDocument();
    expect(mockConstructionApi.addSiteDocument).toHaveBeenCalledWith('site-1-uuid', {
      kind: 'insurance',
      title: 'DURC',
      subcontractor_id: null,
      issued_on: '2026-03-10',
      expires_on: '2026-12-31',
      notes: null,
    });

    component.openCreateSubcontractorModal();
    component.subcontractorForm.patchValue({ name: 'Pavimenti SA', tax_id: 'CHE-111.222.333' });
    component.saveSubcontractor();
    expect(mockConstructionApi.createSubcontractor).toHaveBeenCalledWith({
      name: 'Pavimenti SA',
      contact_id: null,
      tax_id: 'CHE-111.222.333',
      trade: null,
      status: 'active',
      notes: null,
    });

    component.openCreateSubcontractModal();
    component.subcontractForm.patchValue({ description: 'Posa', starts_on: '2026-04-10', ends_on: '2026-04-01' });
    component.saveSubcontract();
    expect(mockConstructionApi.createSiteSubcontract).not.toHaveBeenCalled();
    component.subcontractForm.patchValue({ ends_on: '2026-06-30' });
    component.saveSubcontract();
    expect(mockConstructionApi.createSiteSubcontract).toHaveBeenCalledWith('site-1-uuid', {
      subcontractor_id: 'sub-1-uuid',
      bid_id: null,
      description: 'Posa',
      contract_amount: '25000.00',
      starts_on: '2026-04-10',
      ends_on: '2026-06-30',
    });

    component.openCertifySubcontractModal(mockSubcontract);
    component.certifyForm.patchValue({ certified_on: '2026-04-30', amount: '7500.00', description: '' });
    component.saveCertifySubcontract();
    expect(mockConstructionApi.certifySubcontractWork).not.toHaveBeenCalled();
    component.certifyForm.patchValue({ description: 'SAL 1 subappalto' });
    component.saveCertifySubcontract();
    expect(mockConstructionApi.certifySubcontractWork).toHaveBeenCalledWith('sc-1-uuid', {
      certified_on: '2026-04-30',
      amount: '7500.00',
      description: 'SAL 1 subappalto',
    });
  });
});
