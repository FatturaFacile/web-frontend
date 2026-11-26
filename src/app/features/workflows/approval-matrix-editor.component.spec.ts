import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowApiService, WorkflowApprovalMatrix } from '@core';
import { ApprovalMatrixEditorComponent } from './approval-matrix-editor.component';

const MATRIX: WorkflowApprovalMatrix = {
  id: 'm1',
  code: 'PO_HIGH',
  name: 'High value orders',
  subject_type: 'purchase_order',
  currency: 'CHF',
  priority: 10,
  is_active: true,
  is_default: false,
  auto_approve_below: null,
  fallback_approver: null,
  conditions: [{ field: 'amount', operator: 'gte', value: 10000 }],
  tiers: [
    {
      tier_level: 1,
      threshold_min: null,
      threshold_max: null,
      approver_type: 'role',
      approver_value: 'cfo',
      approval_type: 'single',
    },
  ],
};

describe('ApprovalMatrixEditorComponent', () => {
  let fixture: ComponentFixture<ApprovalMatrixEditorComponent>;
  let component: ApprovalMatrixEditorComponent;

  const api = {
    getSubjectTypes: vi.fn(),
    getMatrices: vi.fn(),
    createMatrix: vi.fn(),
    updateMatrix: vi.fn(),
    simulateMatrix: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getSubjectTypes.mockReturnValue(of({ success: true, message: '', data: [{ code: 'purchase_order', module: 'procurement', registered: true }] }));
    api.getMatrices.mockReturnValue(of({ success: true, message: '', data: [MATRIX], meta: { total: 1 } }));
    api.createMatrix.mockImplementation((payload: object) => of({ success: true, message: '', data: { id: 'm2', ...payload } }));
    api.updateMatrix.mockImplementation((id: string, payload: object) => of({ success: true, message: '', data: { id, ...payload } }));
    api.simulateMatrix.mockReturnValue(
      of({
        success: true,
        message: '',
        data: {
          matrix: { id: 'm1', code: 'PO_HIGH', name: 'High value orders' },
          used_default: false,
          used_fallback: false,
          auto_approved: false,
          blocked: false,
          tiers: [{ tier_level: 1, approver_type: 'role', approver_value: 'cfo', approval_type: 'single' }],
        },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [ApprovalMatrixEditorComponent],
      providers: [provideRouter([]), { provide: WorkflowApiService, useValue: api }, { provide: NzMessageService, useValue: message }],
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalMatrixEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists the matrices and the document types on init', () => {
    expect(api.getMatrices).toHaveBeenCalled();
    expect(component.matrices().length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="matrix-row"]').length).toBe(1);
  });

  it('loads a matrix into the editor', () => {
    component.edit(MATRIX);
    fixture.detectChanges();

    expect(component.draft().id).toBe('m1');
    expect(component.draft().conditions[0].valueText).toBe('10000');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="tier-row"]').length).toBe(1);
  });

  it('edits tiers and conditions immutably', () => {
    component.edit(MATRIX);
    const before = component.draft();

    component.mutate(component.addTier());
    component.mutate(component.setTier(1, 'approver_value', 'ceo'));
    component.mutate(component.addCondition());
    component.mutate(component.removeCondition(0));

    expect(before.tiers.length).toBe(1);
    expect(component.draft().tiers.map((tier) => tier.tier_level)).toEqual([1, 2]);
    expect(component.draft().tiers[1].approver_value).toBe('ceo');
    expect(component.draft().conditions.length).toBe(1);
  });

  it('does not save an invalid matrix and lists the problems', () => {
    component.newMatrix();
    component.save();

    expect(api.createMatrix).not.toHaveBeenCalled();
    expect(component.errors()).toContain('workflows.matrix.error.nameRequired');
  });

  it('creates a new matrix and updates an existing one', () => {
    component.newMatrix();
    component.mutate(component.setText('code', 'PO_LOW'));
    component.mutate(component.setText('name', 'Low value orders'));
    component.mutate(component.setText('subject_type', 'purchase_order'));
    component.mutate(component.setCondition(0, 'valueText', '1000'));
    component.mutate(component.setTier(0, 'approver_value', 'manager'));
    component.save();

    expect(api.createMatrix).toHaveBeenCalledTimes(1);
    expect(api.createMatrix.mock.calls[0][0]).toMatchObject({ code: 'PO_LOW', priority: 20, conditions: [{ field: 'amount', operator: 'gte', value: 1000 }] });
    expect(component.draft().id).toBe('m2');

    component.save();
    expect(api.updateMatrix).toHaveBeenCalledWith('m2', expect.objectContaining({ code: 'PO_LOW' }));
  });

  it('shows the validation message of the API on a 422', () => {
    api.updateMatrix.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Code already taken' } })));
    component.edit(MATRIX);

    component.save();

    expect(component.errors()).toEqual(['Code already taken']);
  });

  it('simulates the selected matrix with the sample attributes', () => {
    component.edit(MATRIX);
    component.patchSim('amount', 15000);
    component.patchSim('currency', 'chf');
    component.patchSim('new_supplier', true);

    component.simulate();
    fixture.detectChanges();

    expect(api.simulateMatrix).toHaveBeenCalledWith({
      subject_type: 'purchase_order',
      matrix_id: 'm1',
      attributes: {
        amount: 15000,
        currency: 'CHF',
        cost_center_id: undefined,
        category: undefined,
        discount_percent: undefined,
        new_supplier: true,
      },
    });
    expect(component.result()?.tiers[0].approver_value).toBe('cfo');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="simulation-result"]')).not.toBeNull();
  });

  it('asks for a document type before simulating', () => {
    component.newMatrix();
    component.simulate();

    expect(api.simulateMatrix).not.toHaveBeenCalled();
    expect(component.errors().length).toBe(1);
  });
});
