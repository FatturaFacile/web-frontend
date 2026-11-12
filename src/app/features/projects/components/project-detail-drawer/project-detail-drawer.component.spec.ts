import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import {
  AuthStore,
  ProjectApiService,
  ProjectFinancialSummary,
  ProjectResource,
  ProjectTaskResource,
  ProjectTimesheetResource,
} from '@core';
import { ProjectDetailDrawerComponent } from './project-detail-drawer.component';

describe('ProjectDetailDrawerComponent', () => {
  let fixture: ComponentFixture<ProjectDetailDrawerComponent>;
  let component: ProjectDetailDrawerComponent;

  const mockProject: ProjectResource = {
    id: 'proj-1',
    project_number: 'PRJ-2026-001',
    name: 'ERP Deployment',
    description: 'Corporate ERP rollout',
    project_type: 'fixed_price',
    status: 'active',
    billing_method: 'milestone',
    revenue_recognition_method: null,
    contact_id: 'c-1',
    portfolio_id: null,
    parent_project_id: null,
    project_manager_user_id: 'u-1',
    currency: 'CHF',
    contract_value: '50000.00',
    progress_percentage: '40.00',
    health_status: 'on_track',
    planned_start_date: '2026-01-01',
    planned_end_date: '2026-06-30',
    baseline_start_date: null,
    baseline_end_date: null,
    actual_start_date: '2026-01-05',
    actual_end_date: null,
    closed_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const mockFinancials: ProjectFinancialSummary = {
    contract_value: '50000.00',
    planned_cost: '35000.00',
    actual_cost: '18000.00',
    earned_value: '20000.00',
    planned_value: '22000.00',
    cost_variance: '2000.00',
    schedule_variance: '-2000.00',
    cpi: '1.11',
    spi: '0.91',
    eac: '45000.00',
    vac: '5000.00',
    profit_margin_percentage: '30.00',
  };

  const mockTasks: ProjectTaskResource[] = [
    {
      id: 'task-1',
      project_id: 'proj-1',
      project_phase_id: null,
      project_milestone_id: null,
      parent_task_id: null,
      task_number: 'TSK-101',
      wbs_code: '1.1',
      sort_order: 1,
      title: 'Database Setup',
      description: null,
      status: 'completed',
      priority: 'high',
      planned_start_date: '2026-01-01',
      planned_end_date: '2026-01-10',
      baseline_start_date: null,
      baseline_end_date: null,
      actual_start_date: null,
      actual_end_date: null,
      estimated_hours: '20.00',
      actual_hours: '18.00',
      progress_percentage: '100.00',
    },
  ];

  const mockTimesheets: ProjectTimesheetResource[] = [
    {
      id: 'ts-1',
      project_id: 'proj-1',
      project_task_id: 'task-1',
      user_id: 'u-1',
      role: 'Engineer',
      work_date: '2026-11-08',
      hours_worked: '8.00',
      overtime_hours: '0.00',
      is_billable: true,
      cost_rate: '80.00',
      charge_rate: '150.00',
      total_cost: '640.00',
      total_charge: '1200.00',
      status: 'submitted',
      submitted_at: '2026-11-08',
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      work_summary: 'Backend APIs implementation',
    },
  ];

  const mockProjectApi = {
    getFinancialSummary: vi.fn().mockReturnValue(of({ success: true, data: mockFinancials })),
    recalculateEvm: vi.fn().mockReturnValue(of({ success: true, data: null })),
    getTasks: vi.fn().mockReturnValue(of({ success: true, data: mockTasks })),
    createTask: vi.fn().mockReturnValue(of({ success: true, data: mockTasks[0] })),
    getTimesheets: vi.fn().mockReturnValue(of({ success: true, data: mockTimesheets })),
    createTimesheet: vi.fn().mockReturnValue(of({ success: true, data: mockTimesheets[0] })),
    submitTimesheet: vi.fn().mockReturnValue(of({ success: true, data: mockTimesheets[0] })),
    approveTimesheet: vi.fn().mockReturnValue(of({ success: true, data: mockTimesheets[0] })),
    rejectTimesheet: vi.fn().mockReturnValue(of({ success: true, data: mockTimesheets[0] })),
  };

  const mockMessage = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };

  const mockAuthStore = {
    user: vi.fn().mockReturnValue({ id: 'u-1', name: 'Tester' }),
    activeCurrency: vi.fn().mockReturnValue('CHF'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ProjectDetailDrawerComponent],
      providers: [
        provideNzIcons(icons),
        { provide: ProjectApiService, useValue: mockProjectApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('project', mockProject);
    fixture.componentRef.setInput('visible', true);
  });

  it('loads financials, tasks, and timesheets on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockProjectApi.getFinancialSummary).toHaveBeenCalledWith('proj-1');
    expect(mockProjectApi.getTasks).toHaveBeenCalledWith('proj-1');
    expect(mockProjectApi.getTimesheets).toHaveBeenCalledWith('proj-1');
    expect(component.financialSummary()).toEqual(mockFinancials);
    expect(component.tasks()).toEqual(mockTasks);
    expect(component.timesheets()).toEqual(mockTimesheets);
  });

  it('recalculates EVM indicators', () => {
    fixture.detectChanges();
    component.recalculateEvm();

    expect(mockProjectApi.recalculateEvm).toHaveBeenCalledWith('proj-1');
    expect(mockMessage.success).toHaveBeenCalledWith('projectDetailDrawer.msgEvmIndicatorsRecalculated');
  });

  it('submits create task modal', () => {
    fixture.detectChanges();
    component.openCreateTaskModal();
    component.taskForm.patchValue({
      task_number: 'TSK-200',
      title: 'Frontend Component Specs',
      estimated_hours: 16,
      priority: 'high',
      planned_start_date: '2026-02-01',
      planned_end_date: '2026-02-05',
    });

    component.submitCreateTask();

    expect(mockProjectApi.createTask).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        task_number: 'TSK-200',
        title: 'Frontend Component Specs',
        estimated_hours: 16,
        priority: 'high',
      }),
    );
    expect(mockMessage.success).toHaveBeenCalledWith('projectDetailDrawer.msgTaskCreated');
    expect(component.createTaskModalVisible()).toBe(false);
  });

  it('logs and approves timesheets', () => {
    fixture.detectChanges();
    component.openCreateTimesheetModal();
    component.timesheetForm.patchValue({
      task_id: 'task-1',
      work_date: '2026-11-08',
      hours_worked: 7.5,
      is_billable: true,
      work_summary: 'Unit testing',
    });

    component.submitCreateTimesheet();

    expect(mockProjectApi.createTimesheet).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        user_id: 'u-1',
        task_id: 'task-1',
        work_date: '2026-11-08',
        hours_worked: 7.5,
      }),
    );
    expect(mockMessage.success).toHaveBeenCalledWith('projectDetailDrawer.msgTimesheetLogged');

    component.approveTimesheet(mockTimesheets[0]);
    expect(mockProjectApi.approveTimesheet).toHaveBeenCalledWith('ts-1');
    expect(mockMessage.success).toHaveBeenCalledWith('projectDetailDrawer.msgTimesheetApproved');
  });

  it('does not call the API when the task and timesheet forms are submitted empty', () => {
    component.openCreateTaskModal();
    component.taskForm.patchValue({ task_number: '', title: '', planned_start_date: '', planned_end_date: '' });
    component.submitCreateTask();
    expect(mockProjectApi.createTask).not.toHaveBeenCalled();
    expect(component.taskForm.controls.title.touched).toBe(true);

    component.openCreateTimesheetModal();
    component.timesheetForm.patchValue({ work_date: '' });
    component.submitCreateTimesheet();
    expect(mockProjectApi.createTimesheet).not.toHaveBeenCalled();

    component.timesheetForm.patchValue({ work_date: '2999-01-01' });
    expect(component.timesheetForm.controls.work_date.hasError('futureDate')).toBe(true);
  });

  it('flags a task that ends before it starts', () => {
    component.openCreateTaskModal();
    component.taskForm.patchValue({ planned_start_date: '2026-02-10', planned_end_date: '2026-02-01' });
    expect(component.taskForm.controls.planned_end_date.hasError('endsBeforeStart')).toBe(true);
    component.taskForm.patchValue({ planned_start_date: '2026-01-01' });
    expect(component.taskForm.controls.planned_end_date.hasError('endsBeforeStart')).toBe(false);
  });
});
