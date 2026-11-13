import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
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
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  I18nService,
  ProjectApiService,
  ProjectFinancialSummary,
  ProjectResource,
  ProjectTaskResource,
  ProjectTimesheetResource,
  StoreProjectTaskPayload,
  serverErrorMessage,
  StoreProjectTimesheetPayload,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { endsNotBefore, notInFuture, revalidateOnStartChange } from '@shared/utils/date-validators';

@Component({
  selector: 'app-project-detail-drawer',
  styleUrl: './project-detail-drawer.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    TranslatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzTabsModule,
    NzDescriptionsModule,
    NzBadgeModule,
    NzStatisticModule,
    NzCardModule,
    NzTableModule,
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
    MoneyPipe,
  ],
  templateUrl: './project-detail-drawer.component.html',
})
export class ProjectDetailDrawerComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  project = input.required<ProjectResource>();
  visible = input.required<boolean>();
  closed = output<void>();

  private readonly projectApi = inject(ProjectApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly loadingTasks = signal(false);
  readonly tasks = signal<ProjectTaskResource[]>([]);

  readonly loadingTimesheets = signal(false);
  readonly timesheets = signal<ProjectTimesheetResource[]>([]);

  readonly loadingFinancials = signal(false);
  readonly financialSummary = signal<ProjectFinancialSummary | null>(null);

  // Modals
  readonly createTaskModalVisible = signal(false);
  readonly savingTask = signal(false);
  readonly createTimesheetModalVisible = signal(false);
  readonly savingTimesheet = signal(false);

  readonly taskForm = this.fb.group({
    task_number: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    title: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    estimated_hours: this.fb.control<number | null>(8, [Validators.min(0), Validators.max(999999)]),
    priority: this.fb.control('medium'),
    planned_start_date: this.fb.control('', [Validators.required]),
    planned_end_date: this.fb.control('', [Validators.required, endsNotBefore('planned_start_date')]),
  });

  readonly timesheetForm = this.fb.group({
    task_id: this.fb.control<string | null>(null),
    work_date: this.fb.control('', [Validators.required, notInFuture]),
    hours_worked: this.fb.control<number>(8, [Validators.required, Validators.min(0.01), Validators.max(24)]),
    is_billable: this.fb.control<boolean>(true),
    work_summary: this.fb.control('', [Validators.maxLength(2000)]),
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    revalidateOnStartChange(this.taskForm, 'planned_start_date', 'planned_end_date', this.destroyRef);
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

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const id = this.project().id;
    this.loadFinancials(id);
    this.loadTasks(id);
    this.loadTimesheets(id);
  }

  loadFinancials(projectId: string): void {
    this.loadingFinancials.set(true);
    this.projectApi.getFinancialSummary(projectId).subscribe({
      next: (res) => {
        this.financialSummary.set(res.data);
        this.loadingFinancials.set(false);
      },
      error: () => this.loadingFinancials.set(false),
    });
  }

  recalculateEvm(): void {
    const id = this.project().id;
    this.projectApi.recalculateEvm(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('projectDetailDrawer.msgEvmIndicatorsRecalculated'));
        this.loadFinancials(id);
      },
      error: () => undefined,
    });
  }

  loadTasks(projectId: string): void {
    this.loadingTasks.set(true);
    this.projectApi.getTasks(projectId).subscribe({
      next: (res) => {
        this.tasks.set(res.data || []);
        this.loadingTasks.set(false);
      },
      error: () => {
        this.tasks.set([]);
        this.loadingTasks.set(false);
      },
    });
  }

  loadTimesheets(projectId: string): void {
    this.loadingTimesheets.set(true);
    this.projectApi.getTimesheets(projectId).subscribe({
      next: (res) => {
        this.timesheets.set(res.data || []);
        this.loadingTimesheets.set(false);
      },
      error: () => {
        this.timesheets.set([]);
        this.loadingTimesheets.set(false);
      },
    });
  }

  openCreateTaskModal(): void {
    this.taskForm.reset({
      task_number: '',
      title: '',
      estimated_hours: 8,
      priority: 'medium',
      planned_start_date: new Date().toISOString().slice(0, 10),
      planned_end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    this.createTaskModalVisible.set(true);
  }

  submitCreateTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.savingTask.set(true);
    const formVal = this.taskForm.getRawValue();
    const payload: StoreProjectTaskPayload = {
      task_number: formVal.task_number.trim(),
      title: formVal.title,
      estimated_hours: formVal.estimated_hours ?? undefined,
      priority: formVal.priority,
      planned_start_date: formVal.planned_start_date,
      planned_end_date: formVal.planned_end_date,
      status: 'pending',
    };

    this.projectApi.createTask(this.project().id, payload).subscribe({
      next: () => {
        this.savingTask.set(false);
        this.createTaskModalVisible.set(false);
        this.message.success(this.translate.instant('projectDetailDrawer.msgTaskCreated'));
        this.loadTasks(this.project().id);
      },
      error: () => this.savingTask.set(false),
    });
  }

  openCreateTimesheetModal(): void {
    this.timesheetForm.reset({
      task_id: null,
      work_date: new Date().toISOString().slice(0, 10),
      hours_worked: 8,
      is_billable: true,
      work_summary: '',
    });
    this.createTimesheetModalVisible.set(true);
  }

  submitCreateTimesheet(): void {
    if (this.timesheetForm.invalid) {
      this.timesheetForm.markAllAsTouched();
      return;
    }

    this.savingTimesheet.set(true);
    const formVal = this.timesheetForm.getRawValue();
    const payload: StoreProjectTimesheetPayload = {
      user_id: this.authStore.user()?.id || '',
      task_id: formVal.task_id,
      work_date: formVal.work_date,
      hours_worked: formVal.hours_worked,
      is_billable: formVal.is_billable,
      work_summary: formVal.work_summary,
    };

    this.projectApi.createTimesheet(this.project().id, payload).subscribe({
      next: () => {
        this.savingTimesheet.set(false);
        this.createTimesheetModalVisible.set(false);
        this.message.success(this.translate.instant('projectDetailDrawer.msgTimesheetLogged'));
        this.loadTimesheets(this.project().id);
      },
      error: () => this.savingTimesheet.set(false),
    });
  }

  submitTimesheet(ts: ProjectTimesheetResource): void {
    this.projectApi.submitTimesheet(ts.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('projectDetailDrawer.msgTimesheetSubmittedForApproval'));
        this.loadTimesheets(this.project().id);
      },
      error: () => undefined,
    });
  }

  approveTimesheet(ts: ProjectTimesheetResource): void {
    this.projectApi.approveTimesheet(ts.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('projectDetailDrawer.msgTimesheetApproved'));
        this.loadTimesheets(this.project().id);
      },
      error: () => undefined,
    });
  }

  rejectTimesheet(ts: ProjectTimesheetResource): void {
    this.projectApi.rejectTimesheet(ts.id, 'Hours not recognized').subscribe({
      next: () => {
        this.message.info(this.translate.instant('projectDetailDrawer.msgTimesheetRejected'));
        this.loadTimesheets(this.project().id);
      },
      error: () => undefined,
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
