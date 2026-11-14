import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EamOpsApiService, MaintenancePlan, PermissionsService } from '@core';
import { EaMaintenanceComponent } from './ea-maintenance.component';

const plan: MaintenancePlan = {
  id: 'p1',
  asset_id: null,
  asset_class_id: null,
  plan_code: 'PM-1',
  name: 'Oil change',
  maintenance_type: 'preventive',
  trigger_type: 'time',
  frequency_days: 90,
  meter_code: null,
  meter_interval_units: null,
  last_meter_reading: null,
  next_due_meter: null,
  lead_time_days: null,
  estimated_duration_hours: null,
  estimated_cost: '120.00',
  last_executed_date: null,
  next_due_date: '2026-11-01',
  is_active: true,
  checklist: null,
};

describe('EaMaintenanceComponent', () => {
  const api = {
    getMaintenancePlans: vi.fn(),
    getDueMaintenancePlans: vi.fn(),
    getAssetClasses: vi.fn().mockReturnValue(of({ data: [] })),
    createMaintenancePlan: vi.fn(),
    updateMaintenancePlan: vi.fn(),
    openPlanWorkOrder: vi.fn(),
    getWorkOrder: vi.fn(),
    completeWorkOrder: vi.fn(),
    cancelWorkOrder: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getMaintenancePlans.mockReturnValue(of({ success: true, message: '', data: [plan], meta: { total: 1 } }));
    api.getDueMaintenancePlans.mockReturnValue(of({ data: [plan] }));
    api.openPlanWorkOrder.mockReturnValue(of({ data: { id: 'w1' } }));
    api.getWorkOrder.mockReturnValue(of({ data: { id: 'w1', work_order_number: 'WO-1', status: 'open', is_locked: false }, parts: [] }));
    api.completeWorkOrder.mockReturnValue(of({ data: { id: 'w1' } }));
    await TestBed.configureTestingModule({
      imports: [EaMaintenanceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EamOpsApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
  });

  interface Internals {
    openWorkOrderFromPlan(p: MaintenancePlan): void;
    workOrder(): { data: { id: string } } | null;
    completeForm: { patchValue(v: object): void };
    completeWorkOrder(o: { id: string }): void;
  }

  it('opens the work order of a plan and loads its detail', () => {
    const fixture = TestBed.createComponent(EaMaintenanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Internals;
    component.openWorkOrderFromPlan(plan);
    expect(api.openPlanWorkOrder).toHaveBeenCalledWith('p1');
    expect(api.getWorkOrder).toHaveBeenCalledWith('w1');
    expect(component.workOrder()?.data.id).toBe('w1');
  });

  it('completes a work order with the costs entered', () => {
    const fixture = TestBed.createComponent(EaMaintenanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Internals;
    component.completeForm.patchValue({ labor_cost: 80, condition_after_maintenance: 'good' });
    component.completeWorkOrder({ id: 'w1' });
    const payload = api.completeWorkOrder.mock.calls[0][1];
    expect(api.completeWorkOrder.mock.calls[0][0]).toBe('w1');
    expect(payload.labor_cost).toBe(80);
    expect(payload.condition_after_maintenance).toBe('good');
    expect(payload.resolution_notes).toBeNull();
  });

  it('does not call the API when the plan form is submitted empty or without meter data', () => {
    const fixture = TestBed.createComponent(EaMaintenanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      savePlan(): void;
      planForm: { patchValue(v: object): void; controls: { name: { touched: boolean } } };
    };
    component.savePlan();
    expect(api.createMaintenancePlan).not.toHaveBeenCalled();
    expect(component.planForm.controls.name.touched).toBe(true);

    component.planForm.patchValue({ name: 'Plan', trigger_type: 'meter' });
    component.savePlan();
    expect(api.createMaintenancePlan).not.toHaveBeenCalled();
  });

  it('requires an asset unless an asset class is chosen (required_without:asset_class_id)', () => {
    api.createMaintenancePlan.mockReturnValue(of({ data: plan }));
    const fixture = TestBed.createComponent(EaMaintenanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      savePlan(): void;
      planForm: { patchValue(v: object): void; controls: { asset_id: { hasError(e: string): boolean } } };
    };
    component.planForm.patchValue({ name: 'Plan' });
    component.savePlan();
    expect(api.createMaintenancePlan).not.toHaveBeenCalled();
    expect(component.planForm.controls.asset_id.hasError('required')).toBe(true);

    component.planForm.patchValue({ asset_class_id: 'class-1' });
    component.savePlan();
    const payload = api.createMaintenancePlan.mock.calls[0][0];
    expect(payload.asset_class_id).toBe('class-1');
    expect(payload.asset_id).toBeNull();
  });
});
