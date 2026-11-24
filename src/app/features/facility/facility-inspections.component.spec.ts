import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, FacilityApiService, FacilityInspection, FacilityInspectionTemplate, TranslateService } from '@core';
import { FacilityInspectionsComponent } from './facility-inspections.component';

describe('FacilityInspectionsComponent', () => {
  const inspection: FacilityInspection = {
    id: 'i-1',
    template_id: 't-1',
    number: 'INS-2027-0001',
    title: 'Estintori',
    building_id: null,
    space_id: null,
    assignee_id: null,
    due_date: '2020-01-01',
    status: 'scheduled',
    result: null,
    checklist: [
      { key: 'seal', label: 'Seal intact', type: 'pass_fail', required: true, result: null, value: null, notes: null },
      { key: 'pressure', label: 'Pressure (bar)', type: 'number', required: false, result: null, value: null, notes: null },
    ],
    started_at: null,
    completed_at: null,
    notes: null,
    service_request_id: null,
  };
  const template: FacilityInspectionTemplate = {
    id: 't-1',
    name: 'Estintori',
    building_id: null,
    space_id: null,
    frequency: 'monthly',
    interval_count: 1,
    checklist: [{ key: 'seal', label: 'Seal intact', type: 'pass_fail', required: true }],
    assignee_id: null,
    next_due_date: '2027-06-01',
    lead_days: 0,
    last_generated_on: null,
    is_active: true,
    notes: null,
  };

  const api = {
    getInspections: vi.fn(),
    getInspectionTemplates: vi.fn(),
    getBuildings: vi.fn(),
    startInspection: vi.fn(),
    completeInspection: vi.fn(),
    cancelInspection: vi.fn(),
    createInspectionTemplate: vi.fn(),
    updateInspectionTemplate: vi.fn(),
    deleteInspectionTemplate: vi.fn(),
    generateInspections: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translate = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
  let roles = ['technician'];
  const auth = { user: () => ({ id: 'usr-1' }), activeRoles: () => roles, userPermissions: () => [] as string[] };

  function create(): FacilityInspectionsComponent {
    const fixture = TestBed.createComponent(FacilityInspectionsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    roles = ['technician'];
    api.getInspections.mockReturnValue(of({ data: [inspection] }));
    api.getInspectionTemplates.mockReturnValue(of({ data: [template] }));
    api.getBuildings.mockReturnValue(of({ data: [] }));
    api.completeInspection.mockReturnValue(of({ data: { ...inspection, status: 'completed', result: 'fail' } }));
    api.createInspectionTemplate.mockReturnValue(of({ data: template }));
    api.generateInspections.mockReturnValue(of({ data: [inspection, inspection] }));

    TestBed.configureTestingModule({
      imports: [FacilityInspectionsComponent],
      providers: [
        { provide: FacilityApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: TranslateService, useValue: translate },
        { provide: AuthStore, useValue: auth },
        provideNzIcons(icons),
      ],
    });
  });

  it('loads the worklist and the templates for an operator and flags what is overdue', () => {
    const component = create();

    expect(api.getInspections).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled' }));
    expect(component.inspections()).toHaveLength(1);
    expect(component.templates()).toHaveLength(1);
    expect(component.isOverdue(inspection)).toBe(true);
    expect(component.isOverdue({ ...inspection, status: 'completed' })).toBe(false);
  });

  it('loads nothing for a member who is not an operator', () => {
    roles = ['member'];

    create();

    expect(api.getInspections).not.toHaveBeenCalled();
  });

  it('completes an inspection with the answers keyed by checklist item', () => {
    const component = create();
    component.openComplete(inspection);
    component.setAnswer('seal', { result: 'fail' });
    component.setAnswer('pressure', { value: '12.5' });
    component.completionNotes.set('North corridor');

    component.complete();

    expect(api.completeInspection).toHaveBeenCalledWith('i-1', {
      answers: [
        { key: 'seal', result: 'fail', value: null, notes: null },
        { key: 'pressure', result: null, value: '12.5', notes: null },
      ],
      notes: 'North corridor',
    });
    expect(message.success).toHaveBeenCalledWith('FACILITY.INSPECTION_FAILED_REQUEST');
    expect(component.completeVisible()).toBe(false);
  });

  it('saves a template with a trimmed checklist and refuses an empty one', () => {
    const component = create();
    component.openTemplate();
    component.templateForm.patchValue({ name: 'HVAC', frequency: 'quarterly', next_due_date: '2027-07-01', lead_days: 3 });
    component.updateRow(0, { label: '  Filter clean  ', type: 'pass_fail' });
    component.addRow();
    component.addRow();
    component.updateRow(1, { label: 'Temperature', type: 'number', required: false });

    component.saveTemplate();

    expect(api.createInspectionTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'HVAC',
        frequency: 'quarterly',
        next_due_date: '2027-07-01',
        lead_days: 3,
        checklist: [
          { label: 'Filter clean', type: 'pass_fail', required: true },
          { label: 'Temperature', type: 'number', required: false },
        ],
      }),
    );

    api.createInspectionTemplate.mockClear();
    component.openTemplate();
    component.updateRow(0, { label: '' });
    component.saveTemplate();
    expect(api.createInspectionTemplate).not.toHaveBeenCalled();
  });

  it('runs the scheduler by hand and reports how many inspections it generated', () => {
    const component = create();

    component.generate();

    expect(api.generateInspections).toHaveBeenCalled();
    expect(translate.instant).toHaveBeenCalledWith('FACILITY.GENERATED', { count: 2 });
    expect(message.success).toHaveBeenCalledWith('FACILITY.GENERATED');
  });
});
