import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  FetchGridModel,
  I18nService,
  isValidationError,
  ProjectApiService,
  ProjectFilterParams,
  ProjectResource,
  serverErrorMessage,
  StoreProjectPayload,
  TranslateService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { RouterLink } from '@angular/router';
import { ProjectDetailDrawerComponent } from './components/project-detail-drawer/project-detail-drawer.component';

@Component({
  selector: 'app-projects',
  styleUrl: './projects.component.scss',
  imports: [
    BaseTableComponent,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    ModalActionsDirective,
    IconActionDirective,
    NzPopconfirmModule,
    NzProgressModule,
    NzIconModule,
    NzEmptyModule,
    NzSpaceModule,
    PageHeaderComponent,
    MoneyPipe,
    ProjectDetailDrawerComponent,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './projects.component.html',
})
export class ProjectsComponent {
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly saving = signal(false);

  /** Server-driven grid: paging, sorting, column filters, grouping and export run on the API. */
  readonly grid = new FetchGridModel<ProjectResource, ProjectFilterParams>((query) => this.projectApi.getProjects(query));

  private readonly nameTpl = viewChild<TemplateRef<{ $implicit: ProjectResource; value: unknown }>>('nameTpl');
  private readonly typeTpl = viewChild<TemplateRef<{ $implicit: ProjectResource; value: unknown }>>('typeTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: ProjectResource; value: unknown }>>('statusTpl');
  private readonly healthTpl = viewChild<TemplateRef<{ $implicit: ProjectResource; value: unknown }>>('healthTpl');
  private readonly progressTpl = viewChild<TemplateRef<{ $implicit: ProjectResource; value: unknown }>>('progressTpl');
  private readonly valueTpl = viewChild<TemplateRef<{ $implicit: ProjectResource; value: unknown }>>('valueTpl');

  protected readonly columns = computed<TableColumnDef<ProjectResource>[]>(() => [
    { key: 'name', header: 'PRJ.LBL_PROJECT', customCellTemplate: this.nameTpl() },
    { key: 'project_type', header: 'PRJ.LBL_TYPE', customCellTemplate: this.typeTpl() },
    { key: 'status', header: 'PRJ.LBL_STATUS', customCellTemplate: this.statusTpl() },
    { key: 'health_status', header: 'PRJ.LBL_HEALTH', customCellTemplate: this.healthTpl() },
    { key: 'progress_percentage', header: 'PRJ.LBL_PROGRESS', customCellTemplate: this.progressTpl() },
    { key: 'contract_value', header: 'PRJ.LBL_CONTRACT_VALUE', align: 'right', customCellTemplate: this.valueTpl() },
  ]);

  // Filters
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string | null>(null);

  // Modals & Drawer
  readonly createModalVisible = signal(false);
  readonly selectedProject = signal<ProjectResource | null>(null);
  readonly drawerVisible = signal(false);

  readonly projectForm = this.fb.group({
    project_number: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    contact_id: this.fb.control('', [Validators.required, uuidFormat]),
    project_type: this.fb.control('fixed_price', [Validators.required]),
    billing_method: this.fb.control('milestone', [Validators.required]),
    planned_start_date: this.fb.control('', [Validators.required]),
    planned_end_date: this.fb.control('', [Validators.required, endsNotBefore('planned_start_date')]),
    project_manager_user_id: this.fb.control('', [Validators.required, uuidFormat]),
    contract_value: this.fb.control<number>(0, [Validators.required, Validators.min(0), Validators.max(999999999999)]),
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    revalidateOnStartChange(this.projectForm, 'planned_start_date', 'planned_end_date', this.destroyRef);
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    if (control?.hasError('endsBeforeStart')) {
      return this.i18n.translate('COMMON.VALIDATION.END_AFTER_START');
    }
    if (control?.errors) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
    }
    return '';
  }

  loadProjects(): void {
    this.grid.reload();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.grid.setFilter({ search: val || undefined });
  }

  onStatusChange(status: string | null): void {
    this.statusFilter.set(status);
    this.grid.setFilter({ status: status || undefined });
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
        this.message.success(this.translate.instant('PRJ.MSG_PROJECT_CREATED_SUCCESSFULLY'));
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
        this.message.success(this.translate.instant('PRJ.MSG_PROJECT_STARTED'));
        this.loadProjects();
      },
      error: () => undefined,
    });
  }

  pause(project: ProjectResource): void {
    this.projectApi.pauseProject(project.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('PRJ.MSG_PROJECT_PAUSED'));
        this.loadProjects();
      },
      error: () => undefined,
    });
  }

  complete(project: ProjectResource): void {
    this.projectApi.completeProject(project.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRJ.MSG_PROJECT_MARKED_AS_COMPLETED'));
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
