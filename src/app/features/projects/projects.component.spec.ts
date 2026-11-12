import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, ProjectApiService, ProjectResource } from '@core';
import { ProjectsComponent } from './projects.component';

describe('ProjectsComponent', () => {
  let fixture: ComponentFixture<ProjectsComponent>;
  let component: ProjectsComponent;

  const mockProjects: ProjectResource[] = [
    {
      id: 'proj-1',
      project_number: 'PRJ-2026-001',
      name: 'ERP Deployment',
      description: 'Full ERP implementation',
      project_type: 'fixed_price',
      status: 'active',
      billing_method: 'milestone',
      revenue_recognition_method: null,
      contact_id: 'c-1',
      portfolio_id: null,
      parent_project_id: null,
      project_manager_user_id: 'u-1',
      currency: 'CHF',
      contract_value: '45000.00',
      progress_percentage: '35.00',
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
    },
  ];

  const mockProjectApi = {
    getProjects: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockProjects,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createProject: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockProjects[0],
      }),
    ),
    startProject: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockProjects[0], status: 'active' },
      }),
    ),
    pauseProject: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockProjects[0], status: 'paused' },
      }),
    ),
    completeProject: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockProjects[0], status: 'completed' },
      }),
    ),
    getFinancialSummary: vi.fn().mockReturnValue(of({ success: true, data: null })),
    getTasks: vi.fn().mockReturnValue(of({ success: true, data: [] })),
    getTimesheets: vi.fn().mockReturnValue(of({ success: true, data: [] })),
  };

  const mockMessage = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };

  const mockAuthStore = {
    activeJurisdiction: vi.fn().mockReturnValue('CH'),
    activeCurrency: vi.fn().mockReturnValue('CHF'),
    user: vi.fn().mockReturnValue({ id: 'u-1', name: 'Admin' }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        { provide: ProjectApiService, useValue: mockProjectApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
  });

  it('loads projects list on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockProjectApi.getProjects).toHaveBeenCalled();
    expect(component.projects()).toEqual(mockProjects);
    expect(component.total()).toBe(1);
  });

  it('filters projects by search term', () => {
    fixture.detectChanges();
    const event = { target: { value: 'Deployment' } } as unknown as Event;
    component.onSearch(event);

    expect(component.searchTerm()).toBe('Deployment');
    expect(mockProjectApi.getProjects).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Deployment', page: 1 }),
    );
  });

  it('submits create project form', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.projectForm.patchValue({
      project_number: 'PRJ-2026-999',
      name: 'Cloud Native Migration',
      contact_id: '8d1f0a52-3b6e-4c11-9a7e-1f2d3c4b5a69',
      project_type: 'fixed_price',
      billing_method: 'milestone',
      planned_start_date: '2026-03-01',
      planned_end_date: '2026-09-01',
      project_manager_user_id: '5b2c7e90-1d34-4f68-8a0b-9c1d2e3f4a5b',
      contract_value: 60000,
    });

    component.submitCreateProject();

    expect(mockProjectApi.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        project_number: 'PRJ-2026-999',
        name: 'Cloud Native Migration',
        contact_id: '8d1f0a52-3b6e-4c11-9a7e-1f2d3c4b5a69',
        contract_value: 60000,
        currency: 'CHF',
      }),
    );
    expect(mockMessage.success).toHaveBeenCalledWith('PRJ.MSG_PROJECT_CREATED_SUCCESSFULLY');
    expect(component.createModalVisible()).toBe(false);
  });

  it('triggers start, pause, and complete actions', () => {
    fixture.detectChanges();
    component.start(mockProjects[0]);
    expect(mockProjectApi.startProject).toHaveBeenCalledWith('proj-1');

    component.pause(mockProjects[0]);
    expect(mockProjectApi.pauseProject).toHaveBeenCalledWith('proj-1');

    component.complete(mockProjects[0]);
    expect(mockProjectApi.completeProject).toHaveBeenCalledWith('proj-1');
  });

  it('opens and closes project detail drawer', () => {
    fixture.detectChanges();
    component.openDetail(mockProjects[0]);

    expect(component.drawerVisible()).toBe(true);
    expect(component.selectedProject()).toEqual(mockProjects[0]);

    component.closeDetail();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedProject()).toBeNull();
  });

  it('does not call the API when the create form is submitted empty', () => {
    component.openCreateModal();
    component.projectForm.patchValue({ project_number: '', name: '', contact_id: '', project_manager_user_id: '' });
    component.submitCreateProject();
    expect(mockProjectApi.createProject).not.toHaveBeenCalled();
    expect(component.projectForm.controls.name.touched).toBe(true);
    expect(component.errorTip(component.projectForm, 'name')).toBe('COMMON.VALIDATION.REQUIRED');
  });

  it('rejects non-UUID ids and an end date before the start', () => {
    component.openCreateModal();
    component.projectForm.patchValue({ contact_id: 'c-2', project_manager_user_id: 'u-1', planned_start_date: '2026-05-10', planned_end_date: '2026-05-01' });
    expect(component.projectForm.controls.contact_id.hasError('uuid')).toBe(true);
    expect(component.projectForm.controls.project_manager_user_id.hasError('uuid')).toBe(true);
    expect(component.errorTip(component.projectForm, 'planned_end_date')).toBe('COMMON.VALIDATION.END_AFTER_START');
  });
});
