import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  ProjectApiService,
  ProjectFinancialSummary,
  ProjectResource,
  ProjectTaskResource,
  ProjectTimesheetResource,
  StoreProjectPayload,
  StoreProjectTaskPayload,
  StoreProjectTimesheetPayload,
} from '@core';

describe('ProjectApiService', () => {
  let service: ProjectApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/projects`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProjectApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches projects with pagination and status filter', () => {
    const mockProjects: ProjectResource[] = [
      {
        id: 'proj-1',
        project_number: 'PRJ-2026-001',
        name: 'Website Redesign',
        description: 'New corporate portal',
        project_type: 'fixed_price',
        status: 'active',
        billing_method: 'milestone',
        revenue_recognition_method: 'percentage_of_completion',
        contact_id: 'c-1',
        portfolio_id: null,
        parent_project_id: null,
        project_manager_user_id: 'u-1',
        currency: 'CHF',
        contract_value: '50000.00',
        progress_percentage: '45.00',
        health_status: 'on_track',
        planned_start_date: '2026-01-01',
        planned_end_date: '2026-06-30',
        baseline_start_date: null,
        baseline_end_date: null,
        actual_start_date: '2026-01-10',
        actual_end_date: null,
        closed_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    service.getProjects({ page: 1, per_page: 10, status: 'active' }).subscribe((res) => {
      expect(res.data).toEqual(mockProjects);
      expect(res.meta.total).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url === baseUrl && r.params.get('status') === 'active');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: mockProjects,
      meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
    });
  });

  it('creates a project and manages lifecycle', () => {
    const payload: StoreProjectPayload = {
      contact_id: 'c-1',
      project_number: 'PRJ-002',
      name: 'Mobile App',
      project_type: 'time_and_materials',
      billing_method: 'time_and_materials',
      planned_start_date: '2026-02-01',
      planned_end_date: '2026-08-01',
      project_manager_user_id: 'u-2',
      contract_value: 30000,
    };

    service.createProject(payload).subscribe((res) => {
      expect(res.data.id).toBe('proj-2');
    });

    const reqCreate = httpMock.expectOne(baseUrl);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, data: { id: 'proj-2', ...payload, status: 'draft' } });

    service.startProject('proj-2').subscribe((res) => {
      expect(res.data.status).toBe('active');
    });

    const reqStart = httpMock.expectOne(`${baseUrl}/proj-2/start`);
    expect(reqStart.request.method).toBe('POST');
    reqStart.flush({ success: true, data: { id: 'proj-2', status: 'active' } });

    service.completeProject('proj-2').subscribe((res) => {
      expect(res.data.status).toBe('completed');
    });

    const reqComplete = httpMock.expectOne(`${baseUrl}/proj-2/complete`);
    expect(reqComplete.request.method).toBe('POST');
    reqComplete.flush({ success: true, data: { id: 'proj-2', status: 'completed' } });
  });

  it('manages project tasks', () => {
    const mockTasks: ProjectTaskResource[] = [
      {
        id: 'task-1',
        project_id: 'proj-1',
        project_phase_id: null,
        project_milestone_id: null,
        parent_task_id: null,
        task_number: 'TSK-01',
        wbs_code: '1.1',
        sort_order: 1,
        title: 'Initial Discovery',
        description: null,
        status: 'completed',
        priority: 'high',
        planned_start_date: '2026-01-01',
        planned_end_date: '2026-01-15',
        baseline_start_date: null,
        baseline_end_date: null,
        actual_start_date: null,
        actual_end_date: null,
        estimated_hours: '40.00',
        actual_hours: '38.50',
        progress_percentage: '100.00',
      },
    ];

    service.getTasks('proj-1').subscribe((res) => {
      expect(res.data).toEqual(mockTasks);
    });

    const reqGet = httpMock.expectOne(`${baseUrl}/proj-1/tasks`);
    expect(reqGet.request.method).toBe('GET');
    reqGet.flush({ success: true, data: mockTasks });

    const taskPayload: StoreProjectTaskPayload = {
      title: 'UI Design Mockups',
      estimated_hours: 60,
    };

    service.createTask('proj-1', taskPayload).subscribe((res) => {
      expect(res.data.title).toBe('UI Design Mockups');
    });

    const reqCreate = httpMock.expectOne(`${baseUrl}/proj-1/tasks`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, data: { id: 'task-2', project_id: 'proj-1', ...taskPayload } });
  });

  it('manages timesheets approval workflow', () => {
    const timesheetPayload: StoreProjectTimesheetPayload = {
      user_id: 'u-1',
      work_date: '2026-11-08',
      hours_worked: 8,
      is_billable: true,
      work_summary: 'Feature implementation',
    };

    service.createTimesheet('proj-1', timesheetPayload).subscribe((res) => {
      expect(res.data.id).toBe('ts-1');
    });

    const reqCreate = httpMock.expectOne(`${baseUrl}/proj-1/timesheets`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, data: { id: 'ts-1', ...timesheetPayload, status: 'draft' } });

    service.submitTimesheet('ts-1').subscribe((res) => {
      expect(res.data.status).toBe('submitted');
    });

    const reqSubmit = httpMock.expectOne(`${baseUrl}/timesheets/ts-1/submit`);
    expect(reqSubmit.request.method).toBe('POST');
    reqSubmit.flush({ success: true, data: { id: 'ts-1', status: 'submitted' } });

    service.approveTimesheet('ts-1').subscribe((res) => {
      expect(res.data.status).toBe('approved');
    });

    const reqApprove = httpMock.expectOne(`${baseUrl}/timesheets/ts-1/approve`);
    expect(reqApprove.request.method).toBe('POST');
    reqApprove.flush({ success: true, data: { id: 'ts-1', status: 'approved' } });
  });

  it('retrieves financial summary and triggers EVM recalculation', () => {
    const mockSummary: ProjectFinancialSummary = {
      contract_value: '50000.00',
      planned_cost: '35000.00',
      actual_cost: '22000.00',
      earned_value: '22500.00',
      planned_value: '25000.00',
      cost_variance: '500.00',
      schedule_variance: '-2500.00',
      cpi: '1.02',
      spi: '0.90',
      eac: '48900.00',
      vac: '1100.00',
      profit_margin_percentage: '30.00',
    };

    service.getFinancialSummary('proj-1').subscribe((res) => {
      expect(res.data.cpi).toBe('1.02');
      expect(res.data.spi).toBe('0.90');
    });

    const reqSummary = httpMock.expectOne(`${baseUrl}/proj-1/financial-summary`);
    expect(reqSummary.request.method).toBe('GET');
    reqSummary.flush({ success: true, data: mockSummary });

    service.recalculateEvm('proj-1').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const reqEvm = httpMock.expectOne(`${baseUrl}/proj-1/recalculate-evm`);
    expect(reqEvm.request.method).toBe('POST');
    reqEvm.flush({ success: true, data: { recalculated: true } });
  });
});
