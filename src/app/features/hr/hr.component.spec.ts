import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  EmployeeResource,
  FrontierWorkerResource,
  HrApiService,
  LeaveRequestResource,
  PayrollRunResource,
  TimesheetResource,
} from '@core';
import { HrComponent } from './hr.component';

describe('HrComponent', () => {
  let component: HrComponent;
  let fixture: ComponentFixture<HrComponent>;
  let apiService: any;
  let messageService: any;

  const mockEmployee: EmployeeResource = {
    id: 'emp-1',
    employee_number: 'EMP-001',
    first_name: 'Mario',
    last_name: 'Rossi',
    full_name: 'Mario Rossi',
    work_email: 'mario.rossi@example.com',
    employment_status: 'probation',
    employment_type: 'full_time',
    hire_date: '2026-01-01',
    base_annual_salary: 35000,
    currency: 'EUR',
  };

  const mockLeave: LeaveRequestResource = {
    id: 'lr-1',
    request_number: 'LR-001',
    employee_id: 'emp-1',
    employee_name: 'Mario Rossi',
    leave_type_id: 'vacation',
    leave_type_name: 'Ferie',
    start_date: '2026-08-01',
    end_date: '2026-08-10',
    total_hours: 40,
    total_days: 5,
    status: 'pending',
  };

  const mockTimesheet: TimesheetResource = {
    id: 'ts-1',
    timesheet_number: 'TS-001',
    employee_id: 'emp-1',
    employee_name: 'Mario Rossi',
    work_date: '2026-04-10',
    regular_hours: 8,
    overtime_hours: 1,
    total_hours: 9,
    billable_hours: 8,
    status: 'submitted',
  };

  const mockPayrollRun: PayrollRunResource = {
    id: 'pr-1',
    month: 4,
    year: 2026,
    country: 'IT',
    status: 'calculated',
    total_gross: 50000,
    total_net: 36000,
    employees_count: 15,
  };

  const mockFrontier: FrontierWorkerResource = {
    id: 'fw-1',
    employee_id: 'emp-1',
    employee_name: 'Mario Rossi',
    canton: 'TI',
    italian_municipality: 'Como',
    status: 'attivo',
  };

  beforeEach(async () => {
    apiService = {
      getEmployees: vi.fn().mockReturnValue(of({ data: [mockEmployee], meta: { total: 1 } })),
      createEmployee: vi.fn().mockReturnValue(of({ data: mockEmployee })),
      completeProbation: vi.fn().mockReturnValue(of({ data: { ...mockEmployee, employment_status: 'active' } })),
      promoteEmployee: vi.fn().mockReturnValue(of({ data: { ...mockEmployee, base_annual_salary: 40000 } })),
      terminateEmployee: vi.fn().mockReturnValue(of({ data: { ...mockEmployee, employment_status: 'terminated' } })),
      getLeaveRequests: vi.fn().mockReturnValue(of({ data: [mockLeave], meta: { total: 1 } })),
      submitLeaveRequest: vi.fn().mockReturnValue(of({ data: mockLeave })),
      approveLeaveRequest: vi.fn().mockReturnValue(of({ data: { ...mockLeave, status: 'approved' } })),
      rejectLeaveRequest: vi.fn().mockReturnValue(of({ data: { ...mockLeave, status: 'rejected' } })),
      getTimesheets: vi.fn().mockReturnValue(of({ data: [mockTimesheet], meta: { total: 1 } })),
      submitTimesheet: vi.fn().mockReturnValue(of({ data: mockTimesheet })),
      approveTimesheet: vi.fn().mockReturnValue(of({ data: { ...mockTimesheet, status: 'approved' } })),
      getPayrollRuns: vi.fn().mockReturnValue(of({ data: [mockPayrollRun], meta: { total: 1 } })),
      getFrontierWorkers: vi.fn().mockReturnValue(of({ data: [mockFrontier], meta: { total: 1 } })),
    };

    messageService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HrComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: HrApiService, useValue: apiService },
        { provide: NzMessageService, useValue: messageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HrComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as any).modal, 'confirm').mockImplementation((config: any) => {
      if (config.nzOnOk) config.nzOnOk();
      return {} as any;
    });
    fixture.detectChanges();
  });

  it('initializes and loads employees, leaves, timesheets, payroll runs, and frontier workers', () => {
    expect(component).toBeTruthy();
    expect(component.employees().length).toBe(1);
    expect(component.leaveRequests().length).toBe(1);
    expect(component.timesheets().length).toBe(1);
    expect(component.payrollRuns().length).toBe(1);
    expect(component.frontierWorkers().length).toBe(1);
    expect(component.kpiTotalEmployees()).toBe(1);
    expect(component.kpiProbationEmployees()).toBe(1);
    expect(component.kpiPendingLeaves()).toBe(1);
  });

  it('submits a new employee hiring form', () => {
    component.openHireModal();
    expect(component.isHireModalVisible()).toBe(true);

    component.hireForm.patchValue({
      first_name: 'Paolo',
      last_name: 'Neri',
      work_email: 'paolo.neri@example.com',
      base_annual_salary: 32000,
      hire_date: new Date('2026-06-01'),
      employment_type: 'full_time',
      weekly_hours: 40,
      probation_months: 6,
    });

    component.submitHire();
    expect(apiService.createEmployee).toHaveBeenCalled();
    expect(component.isHireModalVisible()).toBe(false);
  });

  it('executes employee lifecycle actions: confirm probation, promote, terminate', () => {
    component.completeProbation(mockEmployee);
    expect(apiService.completeProbation).toHaveBeenCalledWith('emp-1');

    component.promoteEmployee(mockEmployee);
    expect(apiService.promoteEmployee).toHaveBeenCalledWith('emp-1', { base_annual_salary: 38500 });

    component.terminateEmployee(mockEmployee);
    expect(apiService.terminateEmployee).toHaveBeenCalledWith('emp-1', expect.objectContaining({ reason: 'Cessazione consensuale' }));
  });

  it('submits, approves and rejects leave requests', () => {
    component.openLeaveModal();
    expect(component.isLeaveModalVisible()).toBe(true);

    component.leaveForm.patchValue({
      employee_id: 'emp-1',
      leave_type_id: 'rol',
      start_date: new Date('2026-09-01'),
      end_date: new Date('2026-09-02'),
      total_hours: 16,
      reason: 'Visita medica',
    });

    component.submitLeaveRequest();
    expect(apiService.submitLeaveRequest).toHaveBeenCalled();
    expect(component.isLeaveModalVisible()).toBe(false);

    component.approveLeave(mockLeave);
    expect(apiService.approveLeaveRequest).toHaveBeenCalledWith('lr-1');

    component.rejectLeave(mockLeave);
    expect(apiService.rejectLeaveRequest).toHaveBeenCalledWith('lr-1');
  });

  it('submits and approves timesheets', () => {
    component.openTimesheetModal();
    expect(component.isTimesheetModalVisible()).toBe(true);

    component.timesheetForm.patchValue({
      employee_id: 'emp-1',
      work_date: new Date('2026-04-15'),
      regular_hours: 8,
      overtime_hours: 2,
      billable_hours: 8,
      description: 'Sviluppo backend ERP',
    });

    component.submitTimesheet();
    expect(apiService.submitTimesheet).toHaveBeenCalled();
    expect(component.isTimesheetModalVisible()).toBe(false);

    component.approveTimesheet(mockTimesheet);
    expect(apiService.approveTimesheet).toHaveBeenCalledWith('ts-1');
  });
});
