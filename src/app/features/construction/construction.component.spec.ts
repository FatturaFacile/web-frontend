import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
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
    client: 'Residenza Bellavista SA',
    location: 'Lugano Centro',
    regime: 'CH',
    sal: 'SAL 2',
    norm: 'SIA 118',
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
    code: 'APP-2026-001',
    title: 'Opere da Muratore e Cemento Armato',
    site_id: 'site-1-uuid',
    client_name: 'Residenza Bellavista SA',
    currency: 'CHF',
    total_amount: '450000.00',
    status: 'submitted',
  };

  const mockPosition: TradesBidPosition = {
    id: 'pos-1-uuid',
    bid_id: 'bid-1-uuid',
    code: '01.02.03',
    description: 'Getto calcestruzzo C25/30',
    unit: 'm³',
    quantity: 120,
    unit_price: '210.00',
    subtotal: '25200.00',
  };

  const mockBidBilling: TradesBilling = {
    id: 'tb-1-uuid',
    bid_id: 'bid-1-uuid',
    sal_number: 'SAL-1',
    date: '2026-03-01',
    amount: '80000.00',
    retention_amount: '8000.00',
    net_payable: '72000.00',
    status: 'certified',
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
    site_id: 'site-1-uuid',
    date: '2026-03-02',
    weather_condition: 'Sereno 18°C',
    workers_count: 8,
    work_performed: 'Armatura solaio e getto pilastri',
  };

  const mockDocument: TradesSiteDocument = {
    id: 'doc-1-uuid',
    site_id: 'site-1-uuid',
    title: 'Piano Operativo di Sicurezza POS',
    category: 'pos',
    expires_at: '2026-12-31',
  };

  const mockSubcontractor: TradesSubcontractor = {
    id: 'sub-1-uuid',
    company_name: 'Edilizia Moderna Sagl',
    vat_number: 'CHE-999.888.777',
    qualification: 'Opere di finitura',
  };

  const mockSubcontract: TradesSubcontract = {
    id: 'sc-1-uuid',
    site_id: 'site-1-uuid',
    subcontractor_id: 'sub-1-uuid',
    subcontractor_name: 'Edilizia Moderna Sagl',
    scope_of_work: 'Posa cartongessi e tinteggiatura',
    contract_amount: '35000.00',
    certified_amount: '10000.00',
    status: 'active',
  };

  const mockConstructionApi = {
    getSites: vi.fn().mockReturnValue(of({ data: [mockSite] })),
    createSite: vi.fn().mockReturnValue(of({ data: mockSite })),
    getProgressBillings: vi.fn().mockReturnValue(of({ data: [mockSal] })),
    createProgressBilling: vi.fn().mockReturnValue(of({ data: mockSal })),
    getBids: vi.fn().mockReturnValue(of({ data: [mockBid] })),
    getBid: vi.fn().mockReturnValue(of({ data: { ...mockBid, positions: [mockPosition] } })),
    createBid: vi.fn().mockReturnValue(of({ data: mockBid })),
    changeBidStatus: vi.fn().mockReturnValue(of({ data: { ...mockBid, status: 'awarded' } })),
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
    certifySubcontractWork: vi.fn().mockReturnValue(of({ data: { ...mockSubcontract, certified_amount: '15000.00' } })),
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
  });

  it('should create new construction site and progress billing SAL', () => {
    component.openCreateSiteModal();
    expect(component.siteModalVisible()).toBe(true);

    component.siteForm.patchValue({
      code: 'CANTIERE-002',
      client: 'Immobiliare SA',
      location: 'Bellinzona',
      regime: 'CH',
    });

    component.saveSite();
    expect(mockConstructionApi.createSite).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CANTIERE-002',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.siteModalVisible()).toBe(false);

    component.openCreateSalModal();
    expect(component.salModalVisible()).toBe(true);

    component.salForm.patchValue({
      construction_site_id: 'site-1-uuid',
      sal_number: 'SAL 2',
      gross_certified_amount: 180000,
    });

    component.saveSal();
    expect(mockConstructionApi.createProgressBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        sal_number: 'SAL 2',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.salModalVisible()).toBe(false);
  });

  it('should create bid and award bid', () => {
    component.openCreateBidModal();
    expect(component.bidModalVisible()).toBe(true);

    component.bidForm.patchValue({
      code: 'APP-2026-002',
      title: 'Opere da Gessista',
      currency: 'CHF',
    });

    component.saveBid();
    expect(mockConstructionApi.createBid).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'APP-2026-002',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.bidModalVisible()).toBe(false);

    component.changeBidStatus(mockBid, 'awarded');
    expect(mockConstructionApi.changeBidStatus).toHaveBeenCalledWith('bid-1-uuid', { status: 'awarded' });
    expect(mockMessageService.success).toHaveBeenCalled();
  });

  it('should open bid drawer, add position, record measurement, and issue SAL', () => {
    component.openBidDrawer(mockBid);
    expect(component.drawerVisible()).toBe(true);
    expect(mockConstructionApi.getBid).toHaveBeenCalledWith('bid-1-uuid');
    expect(mockConstructionApi.getBidBillings).toHaveBeenCalledWith('bid-1-uuid');
    expect(mockConstructionApi.getBudgetControl).toHaveBeenCalledWith('bid-1-uuid');

    component.openAddPositionModal();
    expect(component.positionModalVisible()).toBe(true);
    component.positionForm.patchValue({
      code: '02.01',
      description: 'Massetto sabbia e cemento',
      unit: 'm²',
      quantity: 300,
      unit_price: '35.00',
    });
    component.savePosition();
    expect(mockConstructionApi.addBidPosition).toHaveBeenCalledWith(
      'bid-1-uuid',
      expect.objectContaining({
        description: 'Massetto sabbia e cemento',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.positionModalVisible()).toBe(false);

    component.openAddMeasurementModal('pos-1-uuid');
    expect(component.measurementModalVisible()).toBe(true);
    component.measurementForm.patchValue({
      position_id: 'pos-1-uuid',
      description: 'Misura piano terra',
      quantity: 80,
    });
    component.saveMeasurement();
    expect(mockConstructionApi.recordMeasurement).toHaveBeenCalledWith(
      'bid-1-uuid',
      expect.objectContaining({
        description: 'Misura piano terra',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.measurementModalVisible()).toBe(false);

    component.openIssueBidBillingModal(mockBid);
    expect(component.bidBillingModalVisible()).toBe(true);
    component.bidBillingForm.patchValue({
      sal_number: 'SAL-2',
      amount: '60000.00',
    });
    component.saveBidBilling();
    expect(mockConstructionApi.issueBidBilling).toHaveBeenCalledWith(
      'bid-1-uuid',
      expect.objectContaining({
        sal_number: 'SAL-2',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.bidBillingModalVisible()).toBe(false);

    component.closeBidDrawer();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedBid()).toBeNull();
  });

  it('should record site diary entry, add document, create subcontractor, and certify subcontract', () => {
    component.openCreateDiaryModal();
    expect(component.diaryModalVisible()).toBe(true);
    component.diaryForm.patchValue({
      site_id: 'site-1-uuid',
      work_performed: 'Posa pavimenti piano secondo',
      weather_condition: 'Soleggiato',
    });
    component.saveDiary();
    expect(mockConstructionApi.writeSiteDiary).toHaveBeenCalledWith(
      'site-1-uuid',
      expect.objectContaining({
        work_performed: 'Posa pavimenti piano secondo',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.diaryModalVisible()).toBe(false);

    component.openCreateDocumentModal();
    expect(component.documentModalVisible()).toBe(true);
    component.documentForm.patchValue({
      site_id: 'site-1-uuid',
      title: 'DURC Regolare',
      category: 'durc',
    });
    component.saveDocument();
    expect(mockConstructionApi.addSiteDocument).toHaveBeenCalledWith(
      'site-1-uuid',
      expect.objectContaining({
        title: 'DURC Regolare',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.documentModalVisible()).toBe(false);

    component.openCreateSubcontractorModal();
    expect(component.subcontractorModalVisible()).toBe(true);
    component.subcontractorForm.patchValue({
      company_name: 'Pavimenti SA',
      vat_number: 'CHE-111.222.333',
    });
    component.saveSubcontractor();
    expect(mockConstructionApi.createSubcontractor).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'Pavimenti SA',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.subcontractorModalVisible()).toBe(false);

    component.openCertifySubcontractModal(mockSubcontract);
    expect(component.certifySubcontractModalVisible()).toBe(true);
    component.certifyForm.patchValue({
      amount: '7500.00',
    });
    component.saveCertifySubcontract();
    expect(mockConstructionApi.certifySubcontractWork).toHaveBeenCalledWith('sc-1-uuid', { amount: '7500.00' });
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.certifySubcontractModalVisible()).toBe(false);
  });
});
