import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  EsgEsrsCompleteness,
  EsgEsrsPackage,
  EsgReportingPeriod,
  EsgScope3Report,
  EsgSupplierRequest,
  ProcurementApiService,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { SustainabilityEsrsComponent } from './sustainability-esrs.component';
import { SustainabilityScope3Component } from './sustainability-scope3.component';

const period: EsgReportingPeriod = {
  id: 'per-1',
  name: 'FY 2027',
  starts_on: '2027-01-01',
  ends_on: '2027-12-31',
  status: 'open',
  revenue: null,
  currency: 'EUR',
  employees_fte: null,
};

const pack: EsgEsrsPackage = {
  period_id: 'per-1',
  materiality: { assessment_id: 'dma-1', material_standards: ['E1'], assessed_standards: ['E1', 'S1'], unassessed_standards: [] },
  datapoints: [
    { id: 'dp-1', code: 'E1-6-SCOPE1', standard: 'E1', disclosure: 'E1-6', name: 'Scope 1', description: null, data_type: 'number', unit: 'tCO2e', is_mandatory: true, auto_source: 'inventory.scope_1_tco2e', sort_order: 10, is_active: true, is_required: true, value: null },
    { id: 'dp-2', code: 'S1-1', standard: 'S1', disclosure: 'S1-1', name: 'Policies', description: null, data_type: 'text', unit: null, is_mandatory: true, auto_source: null, sort_order: 20, is_active: true, is_required: false, value: null },
  ],
};

const completeness: EsgEsrsCompleteness = {
  period_id: 'per-1',
  is_complete: false,
  percent: '33.33',
  required: 3,
  complete: 1,
  materiality_assessment_id: 'dma-1',
  standards: [{ standard: 'E1', is_material: true, required: 3, complete: 1, percent: '33.33' }],
  missing: [],
  issues: ['datapoints_missing', 'topic_not_assessed:S2'],
  warnings: ['period_open'],
  scope3_categories_without_data: [6],
  open_supplier_requests: 0,
};

const scope3: EsgScope3Report = {
  period_id: 'per-1',
  total_kg: '1000.0000',
  total_tco2e: '1.000',
  supplier_specific_percent: '0.00',
  categories_with_data: 1,
  unmapped_kg: '0.0000',
  categories: [],
};

const request: EsgSupplierRequest = {
  id: 'req-1',
  reporting_period_id: 'per-1',
  supplier_id: 'sup-1',
  supplier_name: 'Acme',
  document_requirement_id: 'doc-1',
  submission_id: null,
  scope3_category: 1,
  activity_type: 'purchased_goods',
  unit: 'EUR',
  quantity: '20000.0000',
  status: 'requested',
  due_date: null,
  reported_co2e_kg: null,
  calculation_method: null,
  emission_factor_id: null,
  activity_record_id: null,
  notes: null,
  received_at: null,
  applied_at: null,
  created_at: '2027-06-15T09:00:00+00:00',
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

function configure(component: typeof SustainabilityEsrsComponent | typeof SustainabilityScope3Component, api: Record<string, unknown>): void {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      { provide: SustainabilityApiService, useValue: api },
      { provide: ProcurementApiService, useValue: { getSuppliers: vi.fn().mockReturnValue(of({ data: [] })) } },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
    ],
  });
}

describe('SustainabilityEsrsComponent', () => {
  const api = {
    getPeriods: vi.fn(),
    getEsrsPackage: vi.fn(),
    getEsrsCompleteness: vi.fn(),
    recordEsrsValues: vi.fn(),
    syncEsrsFromInventory: vi.fn(),
    installEsrsCatalog: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getPeriods.mockReturnValue(of({ data: [period] }));
    api.getEsrsPackage.mockReturnValue(of({ data: pack }));
    api.getEsrsCompleteness.mockReturnValue(of({ data: completeness }));
    api.recordEsrsValues.mockReturnValue(of({ data: [] }));
    api.syncEsrsFromInventory.mockReturnValue(of({ updated: 6, skipped_approved: 0 }));
    api.installEsrsCatalog.mockReturnValue(of({ created: 41 }));
    configure(SustainabilityEsrsComponent, api);
  });

  it('loads the package and the completeness of the first period and filters by standard', () => {
    const fixture = TestBed.createComponent(SustainabilityEsrsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getEsrsPackage).toHaveBeenCalledWith('per-1');
    expect(api.getEsrsCompleteness).toHaveBeenCalledWith('per-1');
    expect(component.rows()).toHaveLength(2);

    component.standard.set('S1');
    expect(component.rows().map((row) => row.code)).toEqual(['S1-1']);
    expect(component.percentOf(completeness)).toBe(33);
  });

  it('sends the API payload of a number value and of an omission', () => {
    const fixture = TestBed.createComponent(SustainabilityEsrsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.edit(pack.datapoints[0]);
    component.form.patchValue({ status: 'approved', value_number: '12.5' });
    component.save();

    expect(api.recordEsrsValues).toHaveBeenCalledWith('per-1', [
      { datapoint_id: 'dp-1', status: 'approved', value_number: '12.5', value_text: null, value_boolean: null, omission_reason: null },
    ]);
    expect(component.editing()).toBeNull();

    component.edit(pack.datapoints[0]);
    component.form.patchValue({ status: 'not_applicable', value_number: '', omission_reason: 'No such activity' });
    component.save();

    expect(api.recordEsrsValues).toHaveBeenLastCalledWith('per-1', [
      { datapoint_id: 'dp-1', status: 'not_applicable', value_number: null, value_text: null, value_boolean: null, omission_reason: 'No such activity' },
    ]);
  });

  it('shows the validation message of the API and fills from the inventory', () => {
    api.recordEsrsValues.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { 'values.0.status': ['Approving is reserved'] } } })));
    const fixture = TestBed.createComponent(SustainabilityEsrsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.edit(pack.datapoints[0]);
    component.save();
    expect(messageSpy.error).toHaveBeenCalledWith('Approving is reserved');

    component.syncInventory();
    expect(api.syncEsrsFromInventory).toHaveBeenCalledWith('per-1');
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('turns a blocking issue with an argument into its text', () => {
    const component = TestBed.createComponent(SustainabilityEsrsComponent).componentInstance;

    expect(component.issueText('topic_not_assessed:S2')).toBe('SUSTAINABILITY.ESRS_ISSUE_TOPIC_NOT_ASSESSED (S2)');
    expect(component.issueText('datapoints_missing')).toBe('SUSTAINABILITY.ESRS_ISSUE_DATAPOINTS_MISSING');
  });
});

describe('SustainabilityScope3Component', () => {
  const api = {
    getPeriods: vi.fn(),
    getScope3: vi.fn(),
    getSupplierRequests: vi.fn(),
    createSupplierRequest: vi.fn(),
    receiveSupplierRequest: vi.fn(),
    applySupplierRequest: vi.fn(),
    declineSupplierRequest: vi.fn(),
    cancelSupplierRequest: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getPeriods.mockReturnValue(of({ data: [period] }));
    api.getScope3.mockReturnValue(of({ data: scope3 }));
    api.getSupplierRequests.mockReturnValue(of({ data: [request] }));
    api.createSupplierRequest.mockReturnValue(of({ data: request }));
    api.receiveSupplierRequest.mockReturnValue(of({ data: { ...request, status: 'received' } }));
    api.applySupplierRequest.mockReturnValue(of({ data: { ...request, status: 'applied' } }));
    configure(SustainabilityScope3Component, api);
  });

  it('loads the report and the requests of the first period', () => {
    const fixture = TestBed.createComponent(SustainabilityScope3Component);
    fixture.detectChanges();

    expect(api.getScope3).toHaveBeenCalledWith('per-1');
    expect(api.getSupplierRequests).toHaveBeenCalledWith({ reporting_period_id: 'per-1', per_page: 100 });
    expect(fixture.componentInstance.requests()).toHaveLength(1);
  });

  it('derives the Scope 3 category and the unit from the activity type of a request', () => {
    const fixture = TestBed.createComponent(SustainabilityScope3Component);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRequest();
    component.requestForm.patchValue({ supplier_id: 'sup-1', quantity: '1000', due_date: '2027-09-30' });
    component.requestForm.controls.activity_type.setValue('freight_road');
    component.activityChanged('freight_road');
    component.saveRequest();

    expect(api.createSupplierRequest).toHaveBeenCalledWith({
      reporting_period_id: 'per-1',
      supplier_id: 'sup-1',
      scope3_category: 4,
      activity_type: 'freight_road',
      unit: 'tkm',
      quantity: '1000',
      due_date: '2027-09-30',
    });
    expect(component.requestVisible()).toBe(false);
  });

  it('registers the supplier data and applies a received request', () => {
    const fixture = TestBed.createComponent(SustainabilityScope3Component);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openReceive(request);
    component.receiveForm.patchValue({ reported_co2e_kg: '3000', calculation_method: 'Product carbon footprint' });
    component.saveReceive();
    expect(api.receiveSupplierRequest).toHaveBeenCalledWith('req-1', { reported_co2e_kg: '3000', calculation_method: 'Product carbon footprint' });
    expect(component.receiving()).toBeNull();

    component.apply({ ...request, status: 'received' });
    expect(api.applySupplierRequest).toHaveBeenCalledWith('req-1');
    expect(messageSpy.success).toHaveBeenCalledWith('SUSTAINABILITY.SUPPLIER_APPLIED');
  });
});
