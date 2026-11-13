import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { HrApiService } from './hr-api.service';
import {
  EmployeeResource,
  HireEmployeePayload,
  PaginatedResponse,
  SubmitLeaveRequestPayload,
  SubmitTimesheetPayload,
} from '../models';

describe('HrApiService', () => {
  let service: HrApiService;
  let httpMock: HttpTestingController;
  const hrBase = `${environment.apiBaseUrl}/hr`;
  const payrollBase = `${environment.apiBaseUrl}/payroll`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HrApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(HrApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches employees list and executes employee lifecycle actions', () => {
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

    const mockResponse: PaginatedResponse<EmployeeResource> = {
      success: true,
      message: '',
      data: [mockEmployee],
      meta: { current_page: 1, from: 1, last_page: 1, per_page: 15, to: 1, total: 1 },
    };

    service.getEmployees({ page: 1 }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].full_name).toBe('Mario Rossi');
    });

    const getReq = httpMock.expectOne((req) => req.url === `${hrBase}/employees` && req.params.get('page') === '1');
    expect(getReq.request.method).toBe('GET');
    getReq.flush(mockResponse);

    // Complete probation
    service.completeProbation('emp-1').subscribe((res) => {
      expect(res.data.employment_status).toBe('active');
    });
    const probReq = httpMock.expectOne(`${hrBase}/employees/emp-1/complete-probation`);
    expect(probReq.request.method).toBe('POST');
    probReq.flush({ data: { ...mockEmployee, employment_status: 'active' } });

    // Promote
    service.promoteEmployee('emp-1', { new_base_annual_salary: 40000 }).subscribe((res) => {
      expect(res.data.base_annual_salary).toBe(40000);
    });
    const promReq = httpMock.expectOne(`${hrBase}/employees/emp-1/promote`);
    expect(promReq.request.method).toBe('POST');
    promReq.flush({ data: { ...mockEmployee, base_annual_salary: 40000 } });

    // Terminate
    service.terminateEmployee('emp-1', { termination_date: '2026-12-31', reason: 'Dimissioni volontarie' }).subscribe((res) => {
      expect(res.data.employment_status).toBe('terminated');
    });
    const termReq = httpMock.expectOne(`${hrBase}/employees/emp-1/terminate`);
    expect(termReq.request.method).toBe('POST');
    termReq.flush({ data: { ...mockEmployee, employment_status: 'terminated' } });
  });

  it('creates employee with hire payload', () => {
    const payload: HireEmployeePayload = {
      first_name: 'Giulia',
      last_name: 'Bianchi',
      work_email: 'giulia.bianchi@example.com',
      base_annual_salary: 38000,
      hire_date: '2026-06-01',
      employment_type: 'full_time',
    };

    service.createEmployee(payload).subscribe((res) => {
      expect(res.data.id).toBe('emp-2');
    });

    const req = httpMock.expectOne(`${hrBase}/employees`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      data: {
        id: 'emp-2',
        employee_number: 'EMP-002',
        full_name: 'Giulia Bianchi',
        employment_status: 'probation',
        currency: 'EUR',
        ...payload,
      },
    });
  });

  it('handles leave requests workflow', () => {
    const payload: SubmitLeaveRequestPayload = {
      employee_id: 'emp-1',
      leave_type_id: 'lt-vacation',
      start_date: '2026-08-10',
      end_date: '2026-08-21',
      total_hours: 80,
      reason: 'Ferie estive',
    };

    service.submitLeaveRequest(payload).subscribe((res) => {
      expect(res.data.status).toBe('pending');
    });

    const postReq = httpMock.expectOne(`${hrBase}/leave-requests`);
    expect(postReq.request.method).toBe('POST');
    postReq.flush({
      data: {
        id: 'lr-1',
        request_number: 'LR-2026-001',
        total_days: 10,
        status: 'pending',
        ...payload,
      },
    });

    // Approve leave request
    service.approveLeaveRequest('lr-1').subscribe((res) => {
      expect(res.data.status).toBe('approved');
    });
    const appReq = httpMock.expectOne(`${hrBase}/leave-requests/lr-1/approve`);
    expect(appReq.request.method).toBe('POST');
    appReq.flush({ data: { id: 'lr-1', status: 'approved' } });

    // Reject leave request
    service.rejectLeaveRequest('lr-1').subscribe((res) => {
      expect(res.data.status).toBe('rejected');
    });
    const rejReq = httpMock.expectOne(`${hrBase}/leave-requests/lr-1/reject`);
    expect(rejReq.request.method).toBe('POST');
    rejReq.flush({ data: { id: 'lr-1', status: 'rejected' } });
  });

  it('handles timesheets and payroll runs', () => {
    const tsPayload: SubmitTimesheetPayload = {
      employee_id: 'emp-1',
      work_date: '2026-04-15',
      regular_hours: 8,
      overtime_hours: 1,
      billable_hours: 8,
    };

    service.submitTimesheet(tsPayload).subscribe((res) => {
      expect(res.data.id).toBe('ts-1');
    });

    const tsReq = httpMock.expectOne(`${hrBase}/timesheets`);
    expect(tsReq.request.method).toBe('POST');
    tsReq.flush({
      data: {
        id: 'ts-1',
        timesheet_number: 'TS-2026-04-15',
        total_hours: 9,
        status: 'submitted',
        ...tsPayload,
      },
    });

    // Approve timesheet
    service.approveTimesheet('ts-1').subscribe((res) => {
      expect(res.data.status).toBe('approved');
    });
    const appTs = httpMock.expectOne(`${hrBase}/timesheets/ts-1/approve`);
    expect(appTs.request.method).toBe('POST');
    appTs.flush({ data: { id: 'ts-1', status: 'approved' } });

    // Payroll runs
    service.getPayrollRuns().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const payReq = httpMock.expectOne(`${payrollBase}/runs`);
    expect(payReq.request.method).toBe('GET');
    payReq.flush({
      data: [
        {
          id: 'pr-1',
          month: 4,
          year: 2026,
          status: 'calculated',
          total_gross: 45000,
          total_net: 32000,
          employees_count: 12,
        },
      ],
    });
  });
});
