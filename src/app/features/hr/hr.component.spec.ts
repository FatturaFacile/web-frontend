import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  EmployeeResource,
  FrontierWorkerResource,
  HrApiService,
  HrLeaveApiService,
  LeaveRequestResource,
  PayrollRunResource,
  TimesheetResource,
} from '@core';
import { HrComponent } from './hr.component';

describe('HrComponent', () => {
  let component: HrComponent;
  let fixture: ComponentFixture<HrComponent>;
  let apiService: Partial<HrApiService>;
  let messageService: Partial<NzMessageService>;

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
        {
          provide: HrLeaveApiService,
          useValue: { getLeaveTypes: vi.fn().mockReturnValue(of({ data: [{ id: '0b8f6c1e-7a52-4d3b-9c64-2e1f0a9b8c7d', name: 'Ferie', is_active: true }] })) },
        },
        { provide: NzMessageService, useValue: messageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HrComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as unknown as { modal: { confirm: (opts: { nzOnOk?: () => void }) => NzModalRef } }).modal, 'confirm').mockImplementation(config => {
      if (config.nzOnOk) config.nzOnOk();
      return {} as NzModalRef;
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
      employment_type: 'apprentice',
      contract_type: 'fixed_term',
      weekly_hours: 40,
      probation_months: 6,
    });

    component.submitHire();
    expect(apiService.createEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ employment_type: 'apprentice', contract_type: 'fixed_term', hire_date: '2026-06-01' }),
    );
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
      employee_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      start_date: new Date(2026, 8, 1),
      end_date: new Date(2026, 8, 2),
      total_hours: 16,
      reason: 'Visita medica',
    });
    // the leave type comes from the API list (a UUID), not from a fixed category string
    expect(component.leaveForm.controls.leave_type_id.value).toBe('0b8f6c1e-7a52-4d3b-9c64-2e1f0a9b8c7d');

    component.submitLeaveRequest();
    expect(apiService.submitLeaveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', leave_type_id: '0b8f6c1e-7a52-4d3b-9c64-2e1f0a9b8c7d', start_date: '2026-09-01', end_date: '2026-09-02' }),
    );
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
      employee_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
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
  it('does not call the API when the hire, leave or timesheet form is submitted empty or invalid', () => {
    vi.mocked(apiService.createEmployee as never).mockClear();
    component.openHireModal();
    component.hireForm.patchValue({ first_name: '', last_name: '', work_email: 'not-an-email' });
    component.submitHire();
    expect(apiService.createEmployee).not.toHaveBeenCalled();
    expect(component.hireForm.controls.first_name.touched).toBe(true);

    vi.mocked(apiService.submitLeaveRequest as never).mockClear();
    component.openLeaveModal();
    component.leaveForm.patchValue({ employee_id: '' });
    component.submitLeaveRequest();
    expect(apiService.submitLeaveRequest).not.toHaveBeenCalled();
    component.leaveForm.patchValue({
      employee_id: 'emp-1',
      start_date: new Date('2026-09-10'),
      end_date: new Date('2026-09-01'),
    });
    component.submitLeaveRequest();
    expect(apiService.submitLeaveRequest).not.toHaveBeenCalled();

    vi.mocked(apiService.submitTimesheet as never).mockClear();
    component.openTimesheetModal();
    component.timesheetForm.patchValue({ employee_id: '' });
    component.submitTimesheet();
    expect(apiService.submitTimesheet).not.toHaveBeenCalled();
  });
});
