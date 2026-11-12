import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  IntrastatApiService,
  IntrastatDeclaration,
  IntrastatDeclarationLine,
  IntrastatPeriodicityThresholds,
  IntrastatProductProfile,
  TranslateService,
} from '@core';
import { IntrastatComponent } from './intrastat.component';

describe('IntrastatComponent', () => {
  let component: IntrastatComponent;
  let fixture: ComponentFixture<IntrastatComponent>;

  const mockLine: IntrastatDeclarationLine = {
    id: 'line-1',
    line_number: 1,
    section: 1,
    partner_country_code: 'DE',
    partner_vat_number: '123456789',
    amount_eur: 3000,
    cn8_code: '84212100',
  };

  const mockDeclaration: IntrastatDeclaration = {
    id: 'dec-1',
    flow: 'sales',
    model: 'INTRA-1',
    year: 2026,
    periodicity: 'M',
    period: 3,
    reference_number: 1,
    content_code: 0,
    special_case_code: 0,
    includes_statistical_data: true,
    has_annual_flows_above_20_million: false,
    status: 'draft',
    sections: [{ section: 1, count: 5, total_eur: 15000 }],
    lines: [mockLine],
    created_at: '2026-03-31T10:00:00Z',
    updated_at: '2026-03-31T10:00:00Z',
  };

  const mockPurchasesDeclaration: IntrastatDeclaration = {
    id: 'dec-2',
    flow: 'purchases',
    model: 'INTRA-2',
    year: 2026,
    periodicity: 'M',
    period: 3,
    reference_number: 2,
    content_code: 0,
    special_case_code: 0,
    includes_statistical_data: false,
    has_annual_flows_above_20_million: false,
    status: 'submitted',
    protocol_number: 'PROT-123456',
    sections: [{ section: 1, count: 2, total_eur: 8000 }],
    lines: [],
    created_at: '2026-03-31T10:00:00Z',
    updated_at: '2026-03-31T10:00:00Z',
  };

  const mockPeriodicity: IntrastatPeriodicityThresholds = {
    year: 2026,
    advised_periodicity: 'M',
    sales_goods_amount: 150000,
    sales_services_amount: 40000,
    purchases_goods_amount: 250000,
    purchases_services_amount: 100000,
  };

  const mockProfile: IntrastatProductProfile = {
    product_id: 'prod-1',
    product_name: 'Filtro Industriale',
    cn8_code: '84212100',
    supply_kind: 'goods',
    origin_country_code: 'IT',
  };

  const apiSpy = {
    getDeclarations: vi.fn().mockReturnValue(of({ data: [mockDeclaration, mockPurchasesDeclaration] })),
    getDeclaration: vi.fn().mockReturnValue(of({ data: mockDeclaration })),
    createDeclaration: vi.fn().mockReturnValue(of({ data: mockDeclaration })),
    generateDeclaration: vi.fn().mockReturnValue(of({ data: mockDeclaration })),
    updateDeclaration: vi.fn().mockReturnValue(of({ data: mockDeclaration })),
    deleteDeclaration: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
    validateDeclaration: vi.fn().mockReturnValue(of({ data: { is_valid: true } })),
    submitDeclaration: vi.fn().mockReturnValue(of({ data: { ...mockDeclaration, status: 'submitted' } })),
    addLine: vi.fn().mockReturnValue(of({ data: mockLine })),
    deleteLine: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
    exportDeclaration: vi.fn().mockReturnValue(of({ file_name: 'SCINTR26.001', content: 'RAW' })),
    getCodes: vi.fn().mockReturnValue(
      of({
        data: {
          delivery_term_groups: { E: ['EXW'], F: ['FCA', 'FAS', 'FOB'] },
          transport_modes: { '1': 'Trasporto marittimo', '9': 'Propulsione propria' },
        },
      }),
    ),
    getPeriodicity: vi.fn().mockReturnValue(of({ data: mockPeriodicity })),
    getProductProfiles: vi.fn().mockReturnValue(of({ data: [mockProfile] })),
    setProductProfile: vi.fn().mockReturnValue(of({ data: mockProfile })),
    deleteProductProfile: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
  };

  const messageSpy = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [IntrastatComponent],
      providers: [
        { provide: IntrastatApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IntrastatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load declarations, periodicity, and product profiles', () => {
    expect(component).toBeTruthy();
    expect(apiSpy.getDeclarations).toHaveBeenCalledWith({ year: 2026 });
    expect(apiSpy.getPeriodicity).toHaveBeenCalledWith(2026);
    expect(apiSpy.getProductProfiles).toHaveBeenCalled();

    expect(component.declarations().length).toBe(2);
    expect(component.totalSalesEur()).toBe(15000);
    expect(component.totalPurchasesEur()).toBe(8000);
    expect(component.totalDraftCount()).toBe(1);
    expect(component.totalSubmittedCount()).toBe(1);
  });

  it('should build the delivery term and transport mode options from the code lists of the server', () => {
    expect(apiSpy.getCodes).toHaveBeenCalled();
    expect(component.deliveryTermOptions()).toEqual([
      { value: 'E', label: 'E - EXW' },
      { value: 'F', label: 'F - FCA / FAS / FOB' },
    ]);
    expect(component.transportModeOptions()).toEqual([
      { value: '1', label: '1 - Trasporto marittimo' },
      { value: '9', label: '9 - Propulsione propria' },
    ]);
  });

  it('should open create modal and create a new declaration', () => {
    component.openCreateModal();
    expect(component.createModalVisible()).toBe(true);

    component.createForm.patchValue({
      flow: 'sales',
      year: 2026,
      periodicity: 'M',
      period: 5,
    });

    component.submitCreateDeclaration();
    expect(apiSpy.createDeclaration).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'sales',
        year: 2026,
        periodicity: 'M',
        period: 5,
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.DECLARATION_CREATED');
    expect(component.createModalVisible()).toBe(false);
  });

  it('should not call the API when the forms are submitted empty or with an invalid period', () => {
    component.openCreateModal();
    component.createForm.patchValue({ period: 13 });
    component.submitCreateDeclaration();
    expect(apiSpy.createDeclaration).not.toHaveBeenCalled();
    expect(component.createForm.controls.period.touched).toBe(true);

    component.submitForm.patchValue({ protocol_number: '' });
    component.confirmSubmit();
    expect(apiSpy.submitDeclaration).not.toHaveBeenCalled();
  });

  it('should execute auto-generation from invoices', () => {
    component.generateForm.patchValue({
      flow: 'purchases',
      year: 2026,
      periodicity: 'M',
      period: 3,
      unclassified_as: 'goods',
    });

    component.executeAutoGenerate();
    expect(apiSpy.generateDeclaration).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'purchases',
        year: 2026,
        periodicity: 'M',
        period: 3,
        unclassified_as: 'goods',
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.GENERATE_SUCCESS');
    expect(component.selectedTabIndex()).toBe(0);
  });

  it('should validate declaration against customs rules', () => {
    component.validateDeclaration(mockDeclaration);
    expect(apiSpy.validateDeclaration).toHaveBeenCalledWith('dec-1');
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.VALIDATION_SUCCESS');
  });

  it('should submit declaration with protocol number', () => {
    component.openSubmitModal(mockDeclaration);
    expect(component.submitModalVisible()).toBe(true);

    component.submitForm.patchValue({ protocol_number: 'PROT-TEST-1234' });
    component.confirmSubmit();

    expect(apiSpy.submitDeclaration).toHaveBeenCalledWith('dec-1', {
      protocol_number: 'PROT-TEST-1234',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.SUBMITTED_SUCCESS');
    expect(component.submitModalVisible()).toBe(false);
  });

  it('should export declaration to SC-DATA format', () => {
    component.exportScdata(mockDeclaration);
    expect(component.exportFormVisible()).toBe(true);
    component.confirmExport();
    expect(apiSpy.exportDeclaration).not.toHaveBeenCalled();

    component.exportForm.patchValue({ customs_section_code: '123456' });
    component.confirmExport();
    expect(apiSpy.exportDeclaration).toHaveBeenCalledWith({
      declaration_ids: ['dec-1'],
      channel: 'entratel',
      customs_section_code: '123456',
      user_code: undefined,
      site_progressive: undefined,
      sender_code: undefined,
      transmission_date: undefined,
      sequence: undefined,
    });
    expect(component.exportModalVisible()).toBe(true);
    expect(component.exportResult()).toEqual({ file_name: 'SCINTR26.001', content: 'RAW' });
  });

  it('requires user code and site progressive when exporting through customs', () => {
    component.exportScdata(mockDeclaration);
    component.exportForm.patchValue({ channel: 'customs', customs_section_code: '123456' });
    component.confirmExport();
    expect(apiSpy.exportDeclaration).not.toHaveBeenCalled();
    expect(component.exportForm.controls.user_code.hasError('required')).toBe(true);
    expect(component.exportForm.controls.site_progressive.hasError('required')).toBe(true);

    component.exportForm.patchValue({ user_code: 'AB12', site_progressive: 2 });
    component.confirmExport();
    expect(apiSpy.exportDeclaration.mock.calls.at(-1)?.[0]).toMatchObject({ channel: 'customs', user_code: 'AB12', site_progressive: 2 });
  });

  it('should delete a draft declaration', () => {
    component.deleteDeclaration('dec-1');
    expect(apiSpy.deleteDeclaration).toHaveBeenCalledWith('dec-1');
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.DECLARATION_DELETED');
  });

  it('should open declaration drawer, add line and delete line', () => {
    component.openDeclarationDrawer(mockDeclaration);
    expect(apiSpy.getDeclaration).toHaveBeenCalledWith('dec-1');
    expect(component.drawerVisible()).toBe(true);

    component.openAddLineModal();
    expect(component.lineModalVisible()).toBe(true);

    component.lineForm.patchValue({
      section: 1,
      partner_country_code: 'FR',
      amount_eur: 5000,
    });
    component.saveLine();

    expect(apiSpy.addLine).toHaveBeenCalledWith(
      'dec-1',
      expect.objectContaining({
        section: 1,
        partner_country_code: 'FR',
        amount_eur: 5000,
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.LINE_SAVED');

    component.deleteLine('line-1');
    expect(apiSpy.deleteLine).toHaveBeenCalledWith('dec-1', 'line-1');
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.LINE_DELETED');
  });

  it('should save and delete product profiles', () => {
    component.openCreateProfileModal();
    expect(component.profileModalVisible()).toBe(true);

    component.profileForm.patchValue({
      product_id: 'prod-42',
      cn8_code: '84713000',
      supply_kind: 'services',
      service_code: '262011',
    });
    component.saveProductProfile();

    expect(apiSpy.setProductProfile).toHaveBeenCalledWith(
      'prod-42',
      expect.objectContaining({
        supply_kind: 'services',
        cn8_code: '84713000',
        service_code: '262011',
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.PROFILE_SAVED');

    component.deleteProductProfile('prod-1');
    expect(apiSpy.deleteProductProfile).toHaveBeenCalledWith('prod-1');
    expect(messageSpy.success).toHaveBeenCalledWith('INTRASTAT.PROFILE_DELETED');
  });

  it('should return correct flow and status badge colors', () => {
    expect(component.getFlowColor('sales')).toBe('blue');
    expect(component.getFlowColor('purchases')).toBe('orange');

    expect(component.getStatusBadgeColor('submitted')).toBe('success');
    expect(component.getStatusBadgeColor('validated')).toBe('blue');
    expect(component.getStatusBadgeColor('draft')).toBe('warning');
    expect(component.getStatusBadgeColor('other')).toBe('default');
  });

  it('should handle API errors gracefully during actions', () => {
    apiSpy.createDeclaration.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.openCreateModal();
    component.submitCreateDeclaration();
    expect(messageSpy.error).toHaveBeenCalledWith('INTRASTAT.ACTION_ERROR');

    apiSpy.generateDeclaration.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.executeAutoGenerate();
    expect(messageSpy.error).toHaveBeenCalledWith('INTRASTAT.ACTION_ERROR');
  });
});
