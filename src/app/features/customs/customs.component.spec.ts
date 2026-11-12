import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  ClientApiService,
  CustomsApiService,
  CustomsAssessmentDecisionResource,
  CustomsDeclarationResource,
  CustomsDossierResource,
  CustomsProfitabilityResource,
  CustomsShipmentRequestResource,
  CustomsTariffGridResource,
} from '@core';
import { CustomsComponent } from './customs.component';

describe('CustomsComponent', () => {
  let fixture: ComponentFixture<CustomsComponent>;
  let component: CustomsComponent;

  const mockDossiers: CustomsDossierResource[] = [
    {
      id: 'dos-1',
      dossier_number: 'DOS-2026-001',
      customer_contact_id: 'cust-1',
      customer_name: 'Swiss Importer AG',
      service_type: 'standard_customs',
      direction: 'import',
      currency: 'CHF',
      status: 'open',
      origin_country: 'IT',
      destination_country: 'CH',
      gross_weight_kg: 500,
      volume_m3: 2.5,
      packages: 5,
    },
  ];

  const mockDeclarations: CustomsDeclarationResource[] = [
    {
      id: 'decl-1',
      trader_declaration_number: 'DEC-2026-001',
      declaration_type: 'import',
      status: 'draft',
      mrn: '26CH00001234567890',
      total_gross_mass: '500.00',
      total_statistical_value: '12500.00',
      total_packages: 5,
    },
  ];

  const mockAssessments: CustomsAssessmentDecisionResource[] = [
    {
      id: 'ass-1',
      mrn: '26CH00001234567890',
      version: 1,
      document_type: 'eVV',
      direction: 'import',
      document_date: '2026-11-09',
      duty_amount: '150.00',
      vat_amount: '962.50',
      signature_status: 'verified',
    },
  ];

  const mockGrids: CustomsTariffGridResource[] = [
    {
      id: 'grid-1',
      name: 'CH-IT Freight Standard',
      service_type: 'freight_customs',
      currency: 'CHF',
      is_active: true,
    },
  ];

  const mockShipments: CustomsShipmentRequestResource[] = [
    {
      id: 'ship-1',
      request_number: 'REQ-001',
      customer_name: 'Logistics Partner SA',
      status: 'pending',
    },
  ];

  const mockCustomsApi = {
    getDossiers: vi.fn().mockReturnValue(of({ success: true, data: mockDossiers, meta: { total: 1 } })),
    getDossier: vi.fn().mockReturnValue(of({ success: true, data: mockDossiers[0] })),
    createDossier: vi.fn().mockReturnValue(of({ success: true, data: mockDossiers[0] })),
    updateDossier: vi.fn().mockReturnValue(of({ success: true, data: mockDossiers[0] })),
    getDossierProfitability: vi.fn().mockReturnValue(
      of({
        success: true,
        data: {
          currency: 'CHF',
          revenue: '1500.00',
          direct_costs: '900.00',
          indirect_costs: '200.00',
          contribution_margin: '400.00',
          result: '400.00',
          margin_percent: '26.67',
        } as CustomsProfitabilityResource,
      }),
    ),
    invoiceDossier: vi.fn().mockReturnValue(of({ success: true, data: { invoice_id: 'inv-1' } })),
    getDeclarations: vi.fn().mockReturnValue(of({ success: true, data: mockDeclarations, meta: { total: 1 } })),
    createDeclaration: vi.fn().mockReturnValue(of({ success: true, data: mockDeclarations[0] })),
    validateDeclaration: vi.fn().mockReturnValue(of({ success: true, data: { status: 'validated', warnings: [] } })),
    submitDeclaration: vi.fn().mockReturnValue(of({ success: true, data: { mrn: '26CH00001234567890', status: 'submitted' } })),
    cancelDeclaration: vi.fn().mockReturnValue(of({ success: true, data: { status: 'cancelled' } })),
    downloadDeclarationPdf: vi.fn().mockReturnValue(of(new Blob(['pdf content'], { type: 'application/pdf' }))),
    getAssessmentDecisions: vi.fn().mockReturnValue(of({ success: true, data: mockAssessments, meta: { total: 1 } })),
    retrieveAssessmentDecisions: vi.fn().mockReturnValue(of({ success: true, data: { retrieved_count: 3 } })),
    downloadAssessmentPdf: vi.fn().mockReturnValue(of(new Blob(['pdf content'], { type: 'application/pdf' }))),
    getTariffGrids: vi.fn().mockReturnValue(of({ success: true, data: mockGrids })),
    createTariffGrid: vi.fn().mockReturnValue(of({ success: true, data: mockGrids[0] })),
    deleteTariffGrid: vi.fn().mockReturnValue(of({ success: true, data: null })),
    getShipmentRequests: vi.fn().mockReturnValue(of({ success: true, data: mockShipments })),
    acceptShipmentRequest: vi.fn().mockReturnValue(of({ success: true, data: { status: 'accepted' } })),
    refuseShipmentRequest: vi.fn().mockReturnValue(of({ success: true, data: { status: 'refused' } })),
  };

  const mockClientApi = {
    list: vi.fn().mockReturnValue(of({ data: [{ id: 'cust-1', company_name: 'Logistica SA', first_name: null, last_name: null }] })),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomsComponent],
      providers: [
        { provide: CustomsApiService, useValue: mockCustomsApi },
        { provide: ClientApiService, useValue: mockClientApi },
        { provide: NzMessageService, useValue: mockMessage },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes component and loads dossiers', () => {
    expect(component).toBeTruthy();
    expect(mockCustomsApi.getDossiers).toHaveBeenCalled();
    expect(component.dossiers().length).toBe(1);
    expect(component.dossiers()[0].dossier_number).toBe('DOS-2026-001');
  });

  it('submits create dossier modal form', () => {
    component.openCreateDossierModal();
    expect(component.createDossierModalVisible()).toBe(true);

    component.dossierForm.patchValue({
      customer_contact_id: 'cust-1',
      service_type: 'standard_customs',
      direction: 'import',
      currency: 'CHF',
    });

    component.dossierForm.patchValue({ origin_country: 'it', destination_country: 'ch', incoterms: 'dap' });
    component.submitDossierForm();
    expect(mockCustomsApi.createDossier).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_contact_id: 'cust-1',
        service_type: 'standard_customs',
        direction: 'import',
        currency: 'CHF',
        origin_country: 'IT',
        destination_country: 'CH',
        incoterms: 'DAP',
      }),
    );
    expect(component.createDossierModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('does not call the API when the dossier form is submitted empty or with an invalid currency', () => {
    component.openCreateDossierModal();
    component.dossierForm.patchValue({ customer_contact_id: '' });
    component.submitDossierForm();
    expect(mockCustomsApi.createDossier).not.toHaveBeenCalled();
    expect(component.dossierForm.controls.customer_contact_id.touched).toBe(true);

    component.dossierForm.patchValue({ customer_contact_id: 'cust-1', currency: 'EURO' });
    component.submitDossierForm();
    expect(mockCustomsApi.createDossier).not.toHaveBeenCalled();
  });

  it('sends the declaration with upper-case countries and without empty optional fields', () => {
    component.openCreateDeclarationModal();
    component.declarationForm.patchValue({
      declaration_type: 'export',
      trader_declaration_number: '',
      trader_reference: '',
      dispatch_country: 'ch',
      destination_country: 'it',
    });
    component.submitDeclarationForm();
    expect(mockCustomsApi.createDeclaration).toHaveBeenCalledWith({
      declaration_type: 'export',
      trader_declaration_number: undefined,
      trader_reference: undefined,
      customs_office_number: 'CH001234',
      dispatch_country: 'CH',
      destination_country: 'IT',
    });
  });

  it('validates, submits, and cancels customs declaration', () => {
    component.onTabChange(1);
    expect(mockCustomsApi.getDeclarations).toHaveBeenCalled();

    component.validateDeclaration('decl-1');
    expect(mockCustomsApi.validateDeclaration).toHaveBeenCalledWith('decl-1');

    component.submitDeclaration('decl-1');
    expect(mockCustomsApi.submitDeclaration).toHaveBeenCalledWith('decl-1');

    component.cancelDeclaration('decl-1');
    expect(mockCustomsApi.cancelDeclaration).toHaveBeenCalledWith('decl-1');
  });

  it('retrieves assessment decisions and opens profitability', () => {
    component.onTabChange(2);
    expect(mockCustomsApi.getAssessmentDecisions).toHaveBeenCalled();

    component.retrieveAssessments();
    expect(mockCustomsApi.retrieveAssessmentDecisions).toHaveBeenCalled();
    expect(mockMessage.success).toHaveBeenCalled();

    component.openProfitabilityModal('dos-1');
    expect(mockCustomsApi.getDossierProfitability).toHaveBeenCalledWith('dos-1');
    expect(component.profitabilityModalVisible()).toBe(true);
    expect(component.profitabilityData()?.revenue).toBe('1500.00');
  });

  it('manages tariff grids and accepts shipment requests', () => {
    component.onTabChange(3);
    expect(mockCustomsApi.getTariffGrids).toHaveBeenCalled();
    expect(mockCustomsApi.getShipmentRequests).toHaveBeenCalled();

    component.acceptShipmentRequest('ship-1');
    expect(mockCustomsApi.acceptShipmentRequest).toHaveBeenCalledWith('ship-1');
    expect(mockMessage.success).toHaveBeenCalled();
  });
});
