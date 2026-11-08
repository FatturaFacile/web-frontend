import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  isValidationError,
  ProjectApiService,
  ProjectFilterParams,
  ProjectResource,
  StoreProjectPayload,
} from '@core';
import { MoneyPipe, PageHeaderComponent } from '@shared';
import { ProjectDetailDrawerComponent } from './components/project-detail-drawer/project-detail-drawer.component';

@Component({
  selector: 'app-projects',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzIconModule,
    NzEmptyModule,
    NzSpaceModule,
    PageHeaderComponent,
    MoneyPipe,
    ProjectDetailDrawerComponent,
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit {
  private readonly projectApi = inject(ProjectApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly projects = signal<ProjectResource[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);

  // Filters
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string | null>(null);

  // Modals & Drawer
  readonly createModalVisible = signal(false);
  readonly selectedProject = signal<ProjectResource | null>(null);
  readonly drawerVisible = signal(false);

  readonly projectForm = this.fb.group({
    project_number: this.fb.control('', [Validators.required]),
    name: this.fb.control('', [Validators.required]),
    contact_id: this.fb.control('', [Validators.required]),
    project_type: this.fb.control('fixed_price', [Validators.required]),
    billing_method: this.fb.control('milestone', [Validators.required]),
    planned_start_date: this.fb.control('', [Validators.required]),
    planned_end_date: this.fb.control('', [Validators.required]),
    project_manager_user_id: this.fb.control('', [Validators.required]),
    contract_value: this.fb.control<number>(0, [Validators.required, Validators.min(0)]),
  });

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    const params: ProjectFilterParams = {
      page: this.pageIndex(),
      per_page: this.pageSize(),
      search: this.searchTerm() || undefined,
      status: this.statusFilter() || undefined,
    };

    this.projectApi.getProjects(params).subscribe({
      next: (res) => {
        this.projects.set(res.data || []);
        this.total.set(res.meta?.total || (res.data || []).length);
        this.loading.set(false);
      },
      error: () => {
        this.projects.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadProjects();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.pageIndex.set(1);
    this.loadProjects();
  }

  onStatusChange(status: string | null): void {
    this.statusFilter.set(status);
    this.pageIndex.set(1);
    this.loadProjects();
  }

  openCreateModal(): void {
    this.projectForm.reset({
      project_number: `PRJ-${Date.now().toString().slice(-4)}`,
      name: '',
      contact_id: '',
      project_type: 'fixed_price',
      billing_method: 'milestone',
      planned_start_date: new Date().toISOString().slice(0, 10),
      planned_end_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      project_manager_user_id: this.authStore.user()?.id || '',
      contract_value: 0,
    });
    this.createModalVisible.set(true);
  }

  submitCreateProject(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.projectForm.getRawValue();
    const payload: StoreProjectPayload = {
      project_number: formVal.project_number,
      name: formVal.name,
      contact_id: formVal.contact_id,
      project_type: formVal.project_type,
      billing_method: formVal.billing_method,
      planned_start_date: formVal.planned_start_date,
      planned_end_date: formVal.planned_end_date,
      project_manager_user_id: formVal.project_manager_user_id,
      contract_value: formVal.contract_value,
      currency: this.authStore.activeCurrency(),
    };

    this.projectApi.createProject(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success('Project created successfully');
        this.loadProjects();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.projectForm, err);
        }
      },
    });
  }

  start(project: ProjectResource): void {
    this.projectApi.startProject(project.id).subscribe({
      next: () => {
        this.message.success('Project started');
        this.loadProjects();
      },
      error: () => undefined,
    });
  }

  pause(project: ProjectResource): void {
    this.projectApi.pauseProject(project.id).subscribe({
      next: () => {
        this.message.info('Project paused');
        this.loadProjects();
      },
      error: () => undefined,
    });
  }

  complete(project: ProjectResource): void {
    this.projectApi.completeProject(project.id).subscribe({
      next: () => {
        this.message.success('Project marked as completed');
        this.loadProjects();
      },
      error: () => undefined,
    });
  }

  openDetail(project: ProjectResource): void {
    this.selectedProject.set(project);
    this.drawerVisible.set(true);
  }

  closeDetail(): void {
    this.drawerVisible.set(false);
    this.selectedProject.set(null);
    this.loadProjects();
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'processing';
      case 'completed':
        return 'success';
      case 'paused':
        return 'warning';
      case 'closed':
        return 'default';
      default:
        return 'cyan';
    }
  }

  getHealthColor(health: string): string {
    switch (health?.toLowerCase()) {
      case 'on_track':
        return 'green';
      case 'at_risk':
        return 'gold';
      case 'critical':
        return 'red';
      default:
        return 'blue';
    }
  }
}
