import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcurementApiService, SupplierPortalApiService, SupplierQualificationAssessment, SupplierQualificationCriterion, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { SupplierQualificationComponent } from './supplier-qualification.component';

describe('SupplierQualificationComponent', () => {
  let fixture: ComponentFixture<SupplierQualificationComponent>;
  let component: SupplierQualificationComponent;

  const criteria: SupplierQualificationCriterion[] = [
    { id: 'c-1', code: 'QUALITY', name: 'Quality', weight: '50.00', max_score: 5, is_active: true, sort_order: 10 },
    { id: 'c-2', code: 'DELIVERY', name: 'Delivery', weight: '30.00', max_score: 5, is_active: true, sort_order: 20 },
    { id: 'c-3', code: 'OLD', name: 'Old', weight: '20.00', max_score: 5, is_active: false, sort_order: 30 },
  ];

  const draft: SupplierQualificationAssessment = { id: 'as-1', supplier_id: 'sup-1', status: 'draft' };

  const apiSpy = {
    getCriteria: vi.fn(),
    getAssessments: vi.fn(),
    createCriterion: vi.fn(),
    updateCriterion: vi.fn(),
    createAssessment: vi.fn(),
    completeAssessment: vi.fn(),
  };
  const procurementSpy = { getSuppliers: vi.fn() };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getCriteria.mockReturnValue(of({ data: criteria }));
    apiSpy.getAssessments.mockReturnValue(of({ data: [draft] }));
    apiSpy.createCriterion.mockReturnValue(of({ data: criteria[0] }));
    apiSpy.createAssessment.mockReturnValue(of({ data: draft }));
    apiSpy.completeAssessment.mockReturnValue(of({ data: { ...draft, status: 'completed', total_score: '84.00', band: 'A', outcome: 'qualified' } }));
    procurementSpy.getSuppliers.mockReturnValue(of({ data: [{ id: 'sup-1', supplier_code: 'S-1', company_name: 'Fornitore Spa' }] }));

    await TestBed.configureTestingModule({
      imports: [SupplierQualificationComponent],
      providers: [
        { provide: SupplierPortalApiService, useValue: apiSpy },
        { provide: ProcurementApiService, useValue: procurementSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierQualificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sums the weight of the active criteria only', () => {
    expect(component.activeCriteria()).toHaveLength(2);
    expect(component.totalWeight()).toBe(80);
  });

  it('refuses a code that is not upper case and a weight with more than two decimals', () => {
    component.openCriterion(null);
    component.criterionForm.patchValue({ code: 'quality', name: 'Quality', weight: '10.555' });
    expect(component.criterionForm.controls.code.invalid).toBe(true);
    expect(component.criterionForm.controls.weight.invalid).toBe(true);

    component.criterionForm.patchValue({ code: 'QUALITY', weight: '10.55' });
    component.saveCriterion();

    expect(apiSpy.createCriterion).toHaveBeenCalledWith({ code: 'QUALITY', name: 'Quality', weight: '10.55', max_score: 5 });
  });

  it('asks a score for every active criterion and sends them with the assessment', () => {
    component.openAssessment();
    expect(Object.keys(component.scoreForm().controls)).toEqual(['c-1', 'c-2']);

    component.assessmentForm.patchValue({ supplier_id: 'sup-1' });
    component.scoreForm().patchValue({ 'c-1': 5, 'c-2': 3 });
    component.saveAssessment();

    expect(apiSpy.createAssessment).toHaveBeenCalledWith({
      supplier_id: 'sup-1',
      notes: null,
      scores: [
        { criterion_id: 'c-1', score: 5 },
        { criterion_id: 'c-2', score: 3 },
      ],
    });
  });

  it('does not accept a score above the maximum of the criterion', () => {
    component.openAssessment();
    component.assessmentForm.patchValue({ supplier_id: 'sup-1' });
    component.scoreForm().patchValue({ 'c-1': 6 });

    expect(component.scoreForm().invalid).toBe(true);
  });

  it('completes a draft assessment and reports the score', () => {
    component.complete(draft);

    expect(apiSpy.completeAssessment).toHaveBeenCalledWith('as-1');
    expect(messageSpy.success).toHaveBeenCalledWith('SUPPLIER_PORTAL.ASSESSMENT_COMPLETED_MESSAGE');
  });
});
