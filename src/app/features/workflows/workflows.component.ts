import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  FetchGridModel,
  I18nService,
  serverErrorMessage,
  WorkflowApiService,
  WorkflowAuditEntryResource,
  WorkflowAuditVerification,
  WorkflowCreateDelegationRequest,
  WorkflowDefinitionParams,
  WorkflowDefinitionResource,
  WorkflowDelegationModel,
  WorkflowEscalationRule,
  WorkflowInstanceParams,
  WorkflowInstanceResource,
  WorkflowInstanceStatus,
  WorkflowSaveDefinitionRequest,
  WorkflowSaveEscalationRuleRequest,
  WorkflowSlaReport,
  WorkflowStartWorkflowRequest,
  WorkflowTask,
  WorkflowTaskParams,
  QueryFilterParams,
  TranslateService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, PageHeaderComponent, TableColumnDef, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { endsNotBefore, inFuture, revalidateOnStartChange } from '@shared/utils/date-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

/** Document types a workflow can approve: the aliases of config/workflow.php (approvables) with their label key. */
const APPROVABLE_TYPES: { value: string; labelKey: string }[] = [
  { value: 'sales_quote', labelKey: 'WORKFLOWS.LBL_PREVENTIVO_QUOTE' },
  { value: 'opportunity', labelKey: 'WORKFLOWS.LBL_OPPORTUNITA' },
  { value: 'purchase_order', labelKey: 'WORKFLOWS.LBL_ORDINE_D_ACQUISTO' },
  { value: 'purchase_requisition', labelKey: 'WORKFLOWS.LBL_RICHIESTA_D_ACQUISTO' },
  { value: 'passive_invoice', labelKey: 'WORKFLOWS.LBL_FATTURA_PASSIVA' },
  { value: 'inventory_adjustment', labelKey: 'WORKFLOWS.LBL_RETTIFICA_INVENTARIO' },
  { value: 'project', labelKey: 'WORKFLOWS.LBL_PROGETTO' },
  { value: 'project_budget', labelKey: 'WORKFLOWS.LBL_BUDGET_PROGETTO' },
  { value: 'project_change_order', labelKey: 'WORKFLOWS.LBL_VARIANTE_PROGETTO' },
  { value: 'project_cost_entry', labelKey: 'WORKFLOWS.LBL_COSTO_PROGETTO' },
  { value: 'leave_request', labelKey: 'WORKFLOWS.LBL_FERIE_PERMESSO' },
];

/** Scopes of a delegation accepted by the API (`in:all,procurement,expenses,invoicing,hr,custom`). */
const DELEGATION_SCOPES = ['all', 'procurement', 'expenses', 'invoicing', 'hr', 'custom'] as const;

/** Targets of an escalation accepted by the API. */
const ESCALATION_TARGETS: { value: string; labelKey: string }[] = [
  { value: 'reporting_manager', labelKey: 'WORKFLOWS.LBL_MANAGER' },
  { value: 'specific_role', labelKey: 'WORKFLOWS.LBL_RUOLO_SPECIFICO' },
  { value: 'specific_user', labelKey: 'WORKFLOWS.LBL_UTENTE_SPECIFICO' },
];

/** API rule `gt:reminder_hours` on the escalation hours. */
function escalationAfterReminderValidator(control: AbstractControl<number>): ValidationErrors | null {
  const reminder = control.parent?.get('reminder_hours')?.value as number | null | undefined;
  return reminder != null && control.value != null && control.value <= reminder ? { escalationBeforeReminder: true } : null;
}

@Component({
  selector: 'app-workflows',
  styleUrl: './workflows.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzStatisticModule,
    NzSpaceModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './workflows.component.html',
})
export class WorkflowsComponent {
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly message = inject(NzMessageService);
  protected readonly authStore = inject(AuthStore);

  // Active tab index (0: Inbox, 1: Instances, 2: Definitions, 3: Delegations & Rules, 4: SLA)
  protected selectedTabIndex = signal<number>(0);

  // --- TAB 1: INBOX / TASKS ---
  /** Inbox of the user: paging, sorting, column filters and grouping run on the API. */
  protected readonly tasksGrid = new FetchGridModel<WorkflowTask, WorkflowTaskParams>((query) => this.workflowApi.getMyTasks(query));
  readonly tasks = computed(() => this.tasksGrid.items());
  protected readonly taskFilterCode = signal<string>('');

  // Decision Modal
  decisionModalVisible = signal<boolean>(false);
  protected selectedTask = signal<WorkflowTask | null>(null);
  decisionType = signal<'approved' | 'rejected'>('approved');
  decisionComment = signal<string>('');
  protected decisionSubmitting = signal<boolean>(false);

  // --- TAB 2: INSTANCES ---
  protected readonly instancesGrid = new FetchGridModel<WorkflowInstanceResource, WorkflowInstanceParams>((query) =>
    this.workflowApi.getInstances(query),
  );
  readonly instances = computed(() => this.instancesGrid.items());
  protected readonly instanceStatusFilter = signal<WorkflowInstanceStatus | ''>('');

  // Start Instance Modal
  startModalVisible = signal<boolean>(false);
  protected startSubmitting = signal<boolean>(false);
  protected readonly approvableTypes = APPROVABLE_TYPES;
  protected readonly delegationScopes = DELEGATION_SCOPES;
  protected readonly escalationTargets = ESCALATION_TARGETS;
  private readonly destroyRef = inject(DestroyRef);

  readonly startForm = this.fb.group({
    workflow_code: ['', [Validators.required, Validators.maxLength(100)]],
    approvable_type: ['sales_quote', [Validators.required]],
    approvable_id: ['', [Validators.required, uuidFormat]],
    context_note: [''],
  });

  // Audit Trail & Verification Modal
  protected auditModalVisible = signal<boolean>(false);
  protected auditEntries = signal<WorkflowAuditEntryResource[]>([]);
  auditVerification = signal<WorkflowAuditVerification | null>(null);
  protected auditLoading = signal<boolean>(false);
  protected auditInstanceId = signal<string>('');

  // --- TAB 3: DEFINITIONS ---
  protected readonly definitionsGrid = new FetchGridModel<WorkflowDefinitionResource, WorkflowDefinitionParams>((query) =>
    this.workflowApi.getDefinitions(query),
  );
  readonly definitions = computed(() => this.definitionsGrid.items());
  protected readonly definitionSearch = signal<string>('');

  // Create Definition Modal
  createDefModalVisible = signal<boolean>(false);
  protected createDefSubmitting = signal<boolean>(false);
  readonly defForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^[A-Z][A-Z0-9_]*$/)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(5000)]],
    target_entity_type: ['sales_quote', [Validators.required, Validators.maxLength(255)]],
  });

  // --- TAB 4: DELEGATIONS & ESCALATION RULES ---
  protected readonly delegationsGrid = new FetchGridModel<WorkflowDelegationModel, QueryFilterParams>((query) =>
    this.workflowApi.getDelegations(query),
  );
  protected createDelegationVisible = signal<boolean>(false);
  protected delegationSubmitting = signal<boolean>(false);
  readonly delegationForm = this.fb.group({
    delegate_user_id: ['', [Validators.required, uuidFormat, (control: AbstractControl<string>) => this.notSelfDelegate(control)]],
    scope: ['all', [Validators.required]],
    starts_at: ['', [Validators.required]],
    ends_at: ['', [Validators.required, endsNotBefore('starts_at', { strict: true }), inFuture]],
    reason: ['', [Validators.maxLength(1000)]],
  });

  protected readonly rulesGrid = new FetchGridModel<WorkflowEscalationRule, QueryFilterParams>((query) =>
    this.workflowApi.getEscalationRules(query),
  );
  protected createRuleVisible = signal<boolean>(false);
  protected ruleSubmitting = signal<boolean>(false);
  readonly ruleForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    reminder_hours: [24, [Validators.required, Validators.min(1), Validators.max(8760)]],
    escalation_hours: [48, [Validators.required, Validators.min(1), Validators.max(8760), escalationAfterReminderValidator]],
    escalate_to_type: ['reporting_manager', [Validators.required]],
    escalate_to_id: ['', [Validators.maxLength(255)]],
  });

  constructor() {
    revalidateOnStartChange(this.delegationForm, 'starts_at', 'ends_at', this.destroyRef);
    this.ruleForm.controls.reminder_hours.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.ruleForm.controls.escalation_hours.updateValueAndValidity({ emitEvent: false }));
  }

  /** API rule `not_in:<current user>` on the delegate. */
  private notSelfDelegate(control: AbstractControl<string>): ValidationErrors | null {
    const own = this.authStore.user()?.id;
    return own && control.value === own ? { sameAsOther: true } : null;
  }

  /** Forces the definition code to the uppercase the API requires (`regex:/^[A-Z][A-Z0-9_]*$/`). */
  protected uppercaseDefinitionCode(): void {
    const control = this.defForm.controls.code;
    const upper = control.value.toUpperCase();
    if (upper !== control.value) {
      control.setValue(upper);
    }
  }

  protected errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

  // --- Server-driven grid columns ---
  private readonly taskProcessTpl = viewChild<TemplateRef<{ $implicit: WorkflowTask; value: unknown }>>('taskProcessTpl');
  private readonly taskDocumentTpl = viewChild<TemplateRef<{ $implicit: WorkflowTask; value: unknown }>>('taskDocumentTpl');
  private readonly taskStepTpl = viewChild<TemplateRef<{ $implicit: WorkflowTask; value: unknown }>>('taskStepTpl');
  private readonly taskInitiatorTpl = viewChild<TemplateRef<{ $implicit: WorkflowTask; value: unknown }>>('taskInitiatorTpl');
  private readonly taskDueTpl = viewChild<TemplateRef<{ $implicit: WorkflowTask; value: unknown }>>('taskDueTpl');
  private readonly taskStateTpl = viewChild<TemplateRef<{ $implicit: WorkflowTask; value: unknown }>>('taskStateTpl');
  private readonly instanceIdTpl = viewChild<TemplateRef<{ $implicit: WorkflowInstanceResource; value: unknown }>>('instanceIdTpl');
  private readonly instanceProcessTpl = viewChild<TemplateRef<{ $implicit: WorkflowInstanceResource; value: unknown }>>('instanceProcessTpl');
  private readonly instanceDocumentTpl = viewChild<TemplateRef<{ $implicit: WorkflowInstanceResource; value: unknown }>>('instanceDocumentTpl');
  private readonly instanceStatusTpl = viewChild<TemplateRef<{ $implicit: WorkflowInstanceResource; value: unknown }>>('instanceStatusTpl');
  private readonly instanceStartedTpl = viewChild<TemplateRef<{ $implicit: WorkflowInstanceResource; value: unknown }>>('instanceStartedTpl');
  private readonly instanceCompletedTpl = viewChild<TemplateRef<{ $implicit: WorkflowInstanceResource; value: unknown }>>('instanceCompletedTpl');
  private readonly definitionCodeTpl = viewChild<TemplateRef<{ $implicit: WorkflowDefinitionResource; value: unknown }>>('definitionCodeTpl');
  private readonly definitionNameTpl = viewChild<TemplateRef<{ $implicit: WorkflowDefinitionResource; value: unknown }>>('definitionNameTpl');
  private readonly definitionTargetTpl = viewChild<TemplateRef<{ $implicit: WorkflowDefinitionResource; value: unknown }>>('definitionTargetTpl');
  private readonly definitionVersionTpl = viewChild<TemplateRef<{ $implicit: WorkflowDefinitionResource; value: unknown }>>('definitionVersionTpl');
  private readonly definitionPublishedTpl = viewChild<TemplateRef<{ $implicit: WorkflowDefinitionResource; value: unknown }>>('definitionPublishedTpl');
  private readonly definitionActiveTpl = viewChild<TemplateRef<{ $implicit: WorkflowDefinitionResource; value: unknown }>>('definitionActiveTpl');
  private readonly delegationScopeTpl = viewChild<TemplateRef<{ $implicit: WorkflowDelegationModel; value: unknown }>>('delegationScopeTpl');
  private readonly delegationPeriodTpl = viewChild<TemplateRef<{ $implicit: WorkflowDelegationModel; value: unknown }>>('delegationPeriodTpl');
  private readonly delegationStateTpl = viewChild<TemplateRef<{ $implicit: WorkflowDelegationModel; value: unknown }>>('delegationStateTpl');
  private readonly ruleNameTpl = viewChild<TemplateRef<{ $implicit: WorkflowEscalationRule; value: unknown }>>('ruleNameTpl');
  private readonly ruleReminderTpl = viewChild<TemplateRef<{ $implicit: WorkflowEscalationRule; value: unknown }>>('ruleReminderTpl');
  private readonly ruleEscalationTpl = viewChild<TemplateRef<{ $implicit: WorkflowEscalationRule; value: unknown }>>('ruleEscalationTpl');
  private readonly ruleTargetTpl = viewChild<TemplateRef<{ $implicit: WorkflowEscalationRule; value: unknown }>>('ruleTargetTpl');

  private taskState(task: WorkflowTask): string {
    return task.escalated_at ? 'escalated' : task.is_overdue ? 'overdue' : 'pending';
  }

  protected readonly taskColumns = computed<TableColumnDef<WorkflowTask>[]>(() => {
    this.i18n.currentLanguage();
    const label = (state: string): string =>
      this.i18n.translate({ escalated: 'WORKFLOWS.LBL_ESCALATED', overdue: 'WORKFLOWS.LBL_SLA_BREACH' }[state] ?? 'WORKFLOWS.STATE_PENDING');
    return [
      { key: 'workflow_name', serverKey: 'instance.definition.name', header: 'WORKFLOWS.PROCESS', customCellTemplate: this.taskProcessTpl() },
      { key: 'approvable_type', serverKey: 'instance.approvable_type', header: 'WORKFLOWS.DOCUMENT', customCellTemplate: this.taskDocumentTpl() },
      { key: 'node_name', serverKey: 'node.name', header: 'WORKFLOWS.STEP', customCellTemplate: this.taskStepTpl() },
      {
        key: 'initiator_name',
        serverKey: 'instance.creator.name',
        header: 'WORKFLOWS.INITIATOR',
        valueGetter: (task) => task.initiator_name || this.i18n.translate('WORKFLOWS.SYSTEM'),
        valueLabel: (value) => value,
        customCellTemplate: this.taskInitiatorTpl(),
      },
      { key: 'due_at', header: 'WORKFLOWS.DUE_AT', customCellTemplate: this.taskDueTpl() },
      {
        key: 'state',
        header: 'COMMON.STATUS',
        valueGetter: (task) => label(this.taskState(task)),
        valueLabel: label,
        customCellTemplate: this.taskStateTpl(),
      },
    ];
  });

  protected readonly instanceColumns = computed<TableColumnDef<WorkflowInstanceResource>[]>(() => [
    { key: 'id', header: 'ID', filterable: false, groupable: false, customCellTemplate: this.instanceIdTpl() },
    {
      key: 'process',
      serverKey: 'definition.name',
      header: 'WORKFLOWS.PROCESS',
      valueGetter: (inst) => inst.definition?.name || inst.workflow_definition_id,
      customCellTemplate: this.instanceProcessTpl(),
    },
    { key: 'approvable_type', header: 'WORKFLOWS.DOCUMENT', customCellTemplate: this.instanceDocumentTpl() },
    {
      key: 'status',
      header: 'COMMON.STATUS',
      valueGetter: (inst) => inst.status.toUpperCase(),
      valueLabel: (value) => value.toUpperCase(),
      customCellTemplate: this.instanceStatusTpl(),
    },
    { key: 'started_at', header: 'WORKFLOWS.STARTED_AT', customCellTemplate: this.instanceStartedTpl() },
    { key: 'completed_at', header: 'WORKFLOWS.COMPLETED_AT', customCellTemplate: this.instanceCompletedTpl() },
  ]);

  protected readonly definitionColumns = computed<TableColumnDef<WorkflowDefinitionResource>[]>(() => {
    this.i18n.currentLanguage();
    const published = (status: string): string => this.i18n.translate(status === 'published' ? 'WORKFLOWS.LBL_PUBBLICATO' : 'WORKFLOWS.LBL_BOZZA');
    return [
      { key: 'code', header: 'WORKFLOWS.CODE', customCellTemplate: this.definitionCodeTpl() },
      { key: 'name', header: 'COMMON.NAME', customCellTemplate: this.definitionNameTpl() },
      { key: 'target_entity_type', header: 'WORKFLOWS.TARGET_DOC', customCellTemplate: this.definitionTargetTpl() },
      { key: 'version', header: 'WORKFLOWS.VERSION', customCellTemplate: this.definitionVersionTpl() },
      {
        key: 'status',
        header: 'WORKFLOWS.PUBLISHED',
        valueGetter: (def) => published(def.status),
        valueLabel: published,
        customCellTemplate: this.definitionPublishedTpl(),
      },
      {
        key: 'is_active',
        serverKey: 'activity',
        header: 'COMMON.STATUS',
        valueGetter: (def) => this.i18n.translate(def.is_active ? 'WORKFLOWS.STATE_ACTIVE' : 'WORKFLOWS.STATE_INACTIVE'),
        valueLabel: (value) => this.i18n.translate(value === 'active' ? 'WORKFLOWS.STATE_ACTIVE' : 'WORKFLOWS.STATE_INACTIVE'),
        customCellTemplate: this.definitionActiveTpl(),
      },
    ];
  });

  protected readonly delegationColumns = computed<TableColumnDef<WorkflowDelegationModel>[]>(() => {
    this.i18n.currentLanguage();
    const scope = (value: string): string => this.i18n.translate('WORKFLOWS.SCOPE_' + (value || 'all').toUpperCase());
    return [
      {
        key: 'delegate_user_name',
        serverKey: 'delegate.name',
        header: 'WORKFLOWS.DELEGATED_TO',
        valueGetter: (del) => del.delegate_user_name || del.delegate_user_id,
      },
      {
        key: 'scope',
        header: 'WORKFLOWS.SCOPE',
        valueGetter: (del) => scope(del.scope ?? 'all'),
        valueLabel: scope,
        customCellTemplate: this.delegationScopeTpl(),
      },
      { key: 'starts_at', header: 'WORKFLOWS.VALID_PERIOD', customCellTemplate: this.delegationPeriodTpl() },
      {
        key: 'is_active',
        serverKey: 'state',
        header: 'COMMON.STATUS',
        valueGetter: (del) => this.i18n.translate(del.is_active ? 'WORKFLOWS.STATE_ACTIVE' : 'WORKFLOWS.STATE_EXPIRED'),
        valueLabel: (value) => this.i18n.translate(value === 'active' ? 'WORKFLOWS.STATE_ACTIVE' : 'WORKFLOWS.STATE_EXPIRED'),
        customCellTemplate: this.delegationStateTpl(),
      },
    ];
  });

  protected readonly ruleColumns = computed<TableColumnDef<WorkflowEscalationRule>[]>(() => [
    { key: 'name', header: 'COMMON.NAME', customCellTemplate: this.ruleNameTpl() },
    { key: 'reminder_hours', header: 'WORKFLOWS.REMINDER_H', customCellTemplate: this.ruleReminderTpl() },
    { key: 'escalation_hours', header: 'WORKFLOWS.ESCALATION_H', customCellTemplate: this.ruleEscalationTpl() },
    { key: 'escalate_to_type', header: 'WORKFLOWS.ESCALATE_TO', customCellTemplate: this.ruleTargetTpl() },
  ]);

  // --- TAB 5: SLA REPORT ---
  readonly slaReport = signal<WorkflowSlaReport | null>(null);
  protected readonly slaLoading = signal<boolean>(false);

  onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    if (index === 4) {
      this.loadSlaReport();
    }
  }

  // --- TASKS ACTIONS ---
  protected loadTasks(): void {
    this.tasksGrid.reload();
  }

  onTaskCodeChange(code: string): void {
    this.taskFilterCode.set(code);
    this.tasksGrid.setFilter({ definition_code: code || undefined });
  }

  openDecisionModal(task: WorkflowTask, decision: 'approved' | 'rejected'): void {
    this.selectedTask.set(task);
    this.decisionType.set(decision);
    this.decisionComment.set('');
    this.decisionModalVisible.set(true);
  }

  submitDecision(): void {
    const task = this.selectedTask();
    if (!task) return;

    if (this.decisionType() === 'rejected' && !this.decisionComment().trim()) {
      this.message.warning(this.translate.instant('WORKFLOWS.MSG_IL_MOTIVO_DEL_RIFIUTO_E_OBBLIGATORIO'));
      return;
    }

    this.decisionSubmitting.set(true);
    this.workflowApi
      .recordDecision(task.step_id, {
        decision: this.decisionType(),
        comment: this.decisionComment().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.message.success(
            this.decisionType() === 'approved' ? 'Richiesta approvata con successo' : 'Richiesta rifiutata',
          );
          this.decisionModalVisible.set(false);
          this.decisionSubmitting.set(false);
          this.loadTasks();
        },
        error: () => {
          this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_DURANTE_LA_REGISTRAZIONE_DELLA_DECISIONE'));
          this.decisionSubmitting.set(false);
        },
      });
  }

  // --- INSTANCES ACTIONS ---
  protected loadInstances(): void {
    this.instancesGrid.reload();
  }

  protected onInstanceStatusChange(status: WorkflowInstanceStatus | ''): void {
    this.instanceStatusFilter.set(status);
    this.instancesGrid.setFilter({ status: status || undefined });
  }

  openStartModal(): void {
    this.startForm.reset({
      workflow_code: this.definitions()[0]?.code || '',
      approvable_type: 'sales_quote',
      approvable_id: '',
      context_note: '',
    });
    this.startModalVisible.set(true);
  }

  submitStartWorkflow(): void {
    if (this.startForm.invalid) {
      this.startForm.markAllAsTouched();
      return;
    }

    const val = this.startForm.getRawValue();
    const payload: WorkflowStartWorkflowRequest = {
      workflow_code: val.workflow_code,
      approvable_type: val.approvable_type,
      approvable_id: val.approvable_id,
      context_snapshot: val.context_note ? { note: val.context_note } : undefined,
    };

    this.startSubmitting.set(true);
    this.workflowApi.startInstance(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKFLOWS.MSG_ISTANZA_DI_WORKFLOW_AVVIATA_CON_SUCCESSO'));
        this.startModalVisible.set(false);
        this.startSubmitting.set(false);
        this.loadInstances();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_IMPOSSIBILE_AVVIARE_IL_PROCESSO_DI_APPROVAZIONE'));
        this.startSubmitting.set(false);
      },
    });
  }

  protected cancelInstance(inst: WorkflowInstanceResource): void {
    this.workflowApi.cancelInstance(inst.id, 'Annullato manualmente dall operatore').subscribe({
      next: () => {
        this.message.info(this.translate.instant('WORKFLOWS.MSG_ISTANZA_ANNULLATA'));
        this.loadInstances();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_DURANTE_L_ANNULLAMENTO'));
      },
    });
  }

  openAuditTrail(inst: WorkflowInstanceResource): void {
    this.auditInstanceId.set(inst.id);
    this.auditModalVisible.set(true);
    this.auditLoading.set(true);

    this.workflowApi.getInstanceAuditTrail(inst.id).subscribe({
      next: (res) => {
        this.auditEntries.set(res.data);
        this.auditLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_NEL_CARICAMENTO_DEL_REGISTRO_AUDIT'));
        this.auditLoading.set(false);
      },
    });

    this.workflowApi.verifyInstanceAuditTrail(inst.id).subscribe({
      next: (res) => {
        this.auditVerification.set(res.data);
      },
      error: () => {
        this.auditVerification.set(null);
      },
    });
  }

  // --- DEFINITIONS ACTIONS ---
  protected loadDefinitions(): void {
    this.definitionsGrid.reload();
  }

  protected onDefinitionSearchChange(term: string): void {
    this.definitionSearch.set(term);
    this.definitionsGrid.setFilter({ search: term || undefined });
  }

  openCreateDefModal(): void {
    this.defForm.reset({
      code: '',
      name: '',
      description: '',
      target_entity_type: 'sales_quote',
    });
    this.createDefModalVisible.set(true);
  }

  submitCreateDefinition(): void {
    if (this.defForm.invalid) {
      this.defForm.markAllAsTouched();
      return;
    }

    const payload: WorkflowSaveDefinitionRequest = this.defForm.getRawValue();
    this.createDefSubmitting.set(true);
    this.workflowApi.createDefinition(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKFLOWS.MSG_DEFINIZIONE_DI_WORKFLOW_CREATA_CON_SUCCESSO'));
        this.createDefModalVisible.set(false);
        this.createDefSubmitting.set(false);
        this.loadDefinitions();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_DURANTE_LA_CREAZIONE_DELLA_DEFINIZIONE'));
        this.createDefSubmitting.set(false);
      },
    });
  }

  publishDefinition(def: WorkflowDefinitionResource): void {
    this.workflowApi.publishDefinition(def.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKFLOWS.MSG_WORKFLOW_PUBBLICATO_CON_SUCCESSO', { name: def.name }));
        this.loadDefinitions();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_DURANTE_LA_PUBBLICAZIONE_DEL_WORKFLOW'));
      },
    });
  }

  protected deleteDefinition(def: WorkflowDefinitionResource): void {
    this.workflowApi.deleteDefinition(def.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('WORKFLOWS.MSG_DEFINIZIONE_ELIMINATA'));
        this.loadDefinitions();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_IMPOSSIBILE_ELIMINARE_LA_DEFINIZIONE_DI_WORKFLOW'));
      },
    });
  }

  // --- DELEGATIONS & RULES ACTIONS ---
  protected loadDelegations(): void {
    this.delegationsGrid.reload();
  }

  openCreateDelegationModal(): void {
    this.delegationForm.reset({
      delegate_user_id: '',
      scope: 'all',
      starts_at: '',
      ends_at: '',
      reason: '',
    });
    this.createDelegationVisible.set(true);
  }

  submitCreateDelegation(): void {
    if (this.delegationForm.invalid) {
      this.delegationForm.markAllAsTouched();
      return;
    }

    const raw = this.delegationForm.getRawValue();
    const payload: WorkflowCreateDelegationRequest = {
      delegate_user_id: raw.delegate_user_id,
      scope: raw.scope,
      starts_at: raw.starts_at,
      ends_at: raw.ends_at,
      reason: raw.reason || undefined,
    };

    this.delegationSubmitting.set(true);
    this.workflowApi.createDelegation(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKFLOWS.MSG_DELEGA_APPROVAZIONE_REGISTRATA'));
        this.createDelegationVisible.set(false);
        this.delegationSubmitting.set(false);
        this.loadDelegations();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_DURANTE_LA_REGISTRAZIONE_DELLA_DELEGA'));
        this.delegationSubmitting.set(false);
      },
    });
  }

  protected deleteDelegation(del: WorkflowDelegationModel): void {
    this.workflowApi.deleteDelegation(del.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('WORKFLOWS.MSG_DELEGA_REVOCATA'));
        this.loadDelegations();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_IMPOSSIBILE_REVOCARE_LA_DELEGA'));
      },
    });
  }

  protected loadEscalationRules(): void {
    this.rulesGrid.reload();
  }

  openCreateRuleModal(): void {
    this.ruleForm.reset({
      name: '',
      reminder_hours: 24,
      escalation_hours: 48,
      escalate_to_type: 'reporting_manager',
      escalate_to_id: '',
    });
    this.createRuleVisible.set(true);
  }

  submitCreateRule(): void {
    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      return;
    }

    const raw = this.ruleForm.getRawValue();
    const payload: WorkflowSaveEscalationRuleRequest = {
      name: raw.name,
      reminder_hours: raw.reminder_hours,
      escalation_hours: raw.escalation_hours,
      escalate_to_type: raw.escalate_to_type,
      escalate_to_id: raw.escalate_to_type === 'reporting_manager' ? null : raw.escalate_to_id || null,
    };
    this.ruleSubmitting.set(true);
    this.workflowApi.createEscalationRule(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKFLOWS.MSG_REGOLA_DI_ESCALATION_SALVATA_CON_SUCCESSO'));
        this.createRuleVisible.set(false);
        this.ruleSubmitting.set(false);
        this.loadEscalationRules();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_DURANTE_IL_SALVATAGGIO_DELLA_REGOLA'));
        this.ruleSubmitting.set(false);
      },
    });
  }

  protected deleteEscalationRule(rule: WorkflowEscalationRule): void {
    this.workflowApi.deleteEscalationRule(rule.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('WORKFLOWS.MSG_REGOLA_ELIMINATA'));
        this.loadEscalationRules();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_IMPOSSIBILE_ELIMINARE_LA_REGOLA'));
      },
    });
  }

  // --- SLA REPORT ACTIONS ---
  protected loadSlaReport(): void {
    this.slaLoading.set(true);
    this.workflowApi.getSlaReport().subscribe({
      next: (res) => {
        this.slaReport.set(res.data);
        this.slaLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_NEL_CARICAMENTO_DEL_REPORT_SLA'));
        this.slaLoading.set(false);
      },
    });
  }

  // --- HELPERS ---
  protected getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'success';
      case 'pending':
        return 'processing';
      case 'rejected':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }
}
