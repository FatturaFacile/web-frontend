import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  I18nService,
  serverErrorMessage,
  WorkflowApiService,
  WorkflowAuditEntryResource,
  WorkflowAuditVerification,
  WorkflowCreateDelegationRequest,
  WorkflowDefinitionResource,
  WorkflowDelegationModel,
  WorkflowEscalationRule,
  WorkflowInstanceResource,
  WorkflowInstanceStatus,
  WorkflowSaveDefinitionRequest,
  WorkflowSaveEscalationRuleRequest,
  WorkflowSlaReport,
  WorkflowStartWorkflowRequest,
  WorkflowTask,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
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
export class WorkflowsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly message = inject(NzMessageService);
  protected readonly authStore = inject(AuthStore);

  // Active tab index (0: Inbox, 1: Instances, 2: Definitions, 3: Delegations & Rules, 4: SLA)
  protected selectedTabIndex = signal<number>(0);

  // --- TAB 1: INBOX / TASKS ---
  protected readonly tasks = signal<WorkflowTask[]>([]);
  protected readonly tasksLoading = signal<boolean>(false);
  protected readonly tasksTotal = signal<number>(0);
  protected readonly tasksPageIndex = signal<number>(1);
  protected readonly tasksPageSize = signal<number>(10);
  protected readonly taskFilterCode = signal<string>('');

  // Decision Modal
  protected decisionModalVisible = signal<boolean>(false);
  protected selectedTask = signal<WorkflowTask | null>(null);
  protected decisionType = signal<'approved' | 'rejected'>('approved');
  protected decisionComment = signal<string>('');
  protected decisionSubmitting = signal<boolean>(false);

  // --- TAB 2: INSTANCES ---
  protected readonly instances = signal<WorkflowInstanceResource[]>([]);
  protected readonly instancesLoading = signal<boolean>(false);
  protected readonly instancesTotal = signal<number>(0);
  protected readonly instancesPageIndex = signal<number>(1);
  protected readonly instancesPageSize = signal<number>(10);
  protected readonly instanceStatusFilter = signal<WorkflowInstanceStatus | ''>('');

  // Start Instance Modal
  protected startModalVisible = signal<boolean>(false);
  protected startSubmitting = signal<boolean>(false);
  protected readonly approvableTypes = APPROVABLE_TYPES;
  protected readonly delegationScopes = DELEGATION_SCOPES;
  protected readonly escalationTargets = ESCALATION_TARGETS;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly startForm = this.fb.group({
    workflow_code: ['', [Validators.required, Validators.maxLength(100)]],
    approvable_type: ['sales_quote', [Validators.required]],
    approvable_id: ['', [Validators.required, uuidFormat]],
    context_note: [''],
  });

  // Audit Trail & Verification Modal
  protected auditModalVisible = signal<boolean>(false);
  protected auditEntries = signal<WorkflowAuditEntryResource[]>([]);
  protected auditVerification = signal<WorkflowAuditVerification | null>(null);
  protected auditLoading = signal<boolean>(false);
  protected auditInstanceId = signal<string>('');

  // --- TAB 3: DEFINITIONS ---
  protected readonly definitions = signal<WorkflowDefinitionResource[]>([]);
  protected readonly definitionsLoading = signal<boolean>(false);
  protected readonly definitionsTotal = signal<number>(0);
  protected readonly definitionsPageIndex = signal<number>(1);
  protected readonly definitionsPageSize = signal<number>(10);
  protected readonly definitionSearch = signal<string>('');

  // Create Definition Modal
  protected createDefModalVisible = signal<boolean>(false);
  protected createDefSubmitting = signal<boolean>(false);
  protected readonly defForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^[A-Z][A-Z0-9_]*$/)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(5000)]],
    target_entity_type: ['sales_quote', [Validators.required, Validators.maxLength(255)]],
  });

  // --- TAB 4: DELEGATIONS & ESCALATION RULES ---
  protected readonly delegations = signal<WorkflowDelegationModel[]>([]);
  protected readonly delegationsLoading = signal<boolean>(false);
  protected createDelegationVisible = signal<boolean>(false);
  protected delegationSubmitting = signal<boolean>(false);
  protected readonly delegationForm = this.fb.group({
    delegate_user_id: ['', [Validators.required, uuidFormat, (control: AbstractControl<string>) => this.notSelfDelegate(control)]],
    scope: ['all', [Validators.required]],
    starts_at: ['', [Validators.required]],
    ends_at: ['', [Validators.required, endsNotBefore('starts_at', { strict: true }), inFuture]],
    reason: ['', [Validators.maxLength(1000)]],
  });

  protected readonly escalationRules = signal<WorkflowEscalationRule[]>([]);
  protected readonly rulesLoading = signal<boolean>(false);
  protected createRuleVisible = signal<boolean>(false);
  protected ruleSubmitting = signal<boolean>(false);
  protected readonly ruleForm = this.fb.group({
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

  // --- TAB 5: SLA REPORT ---
  protected readonly slaReport = signal<WorkflowSlaReport | null>(null);
  protected readonly slaLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadTasks();
  }

  protected onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    if (index === 0 && this.tasks().length === 0) {
      this.loadTasks();
    } else if (index === 1 && this.instances().length === 0) {
      this.loadInstances();
    } else if (index === 2 && this.definitions().length === 0) {
      this.loadDefinitions();
    } else if (index === 3) {
      this.loadDelegations();
      this.loadEscalationRules();
    } else if (index === 4) {
      this.loadSlaReport();
    }
  }

  // --- TASKS ACTIONS ---
  protected loadTasks(): void {
    this.tasksLoading.set(true);
    this.workflowApi
      .getMyTasks({
        workflow_code: this.taskFilterCode() || undefined,
        page: this.tasksPageIndex(),
        per_page: this.tasksPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.tasks.set(res.data);
          this.tasksTotal.set(res.meta?.total ?? res.data.length);
          this.tasksLoading.set(false);
        },
        error: () => {
          this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_ATTIVITA_IN'));
          this.tasksLoading.set(false);
        },
      });
  }

  protected onTasksTableQueryChange(params: NzTableQueryParams): void {
    this.tasksPageIndex.set(params.pageIndex);
    this.tasksPageSize.set(params.pageSize);
    this.loadTasks();
  }

  protected openDecisionModal(task: WorkflowTask, decision: 'approved' | 'rejected'): void {
    this.selectedTask.set(task);
    this.decisionType.set(decision);
    this.decisionComment.set('');
    this.decisionModalVisible.set(true);
  }

  protected submitDecision(): void {
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
    this.instancesLoading.set(true);
    this.workflowApi
      .getInstances({
        status: (this.instanceStatusFilter() || undefined) as WorkflowInstanceStatus | undefined,
        page: this.instancesPageIndex(),
        per_page: this.instancesPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.instances.set(res.data);
          this.instancesTotal.set(res.meta?.total ?? res.data.length);
          this.instancesLoading.set(false);
        },
        error: () => {
          this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_ISTANZE_DI'));
          this.instancesLoading.set(false);
        },
      });
  }

  protected onInstancesTableQueryChange(params: NzTableQueryParams): void {
    this.instancesPageIndex.set(params.pageIndex);
    this.instancesPageSize.set(params.pageSize);
    this.loadInstances();
  }

  protected openStartModal(): void {
    this.startForm.reset({
      workflow_code: this.definitions()[0]?.code || '',
      approvable_type: 'sales_quote',
      approvable_id: '',
      context_note: '',
    });
    this.startModalVisible.set(true);
  }

  protected submitStartWorkflow(): void {
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

  protected openAuditTrail(inst: WorkflowInstanceResource): void {
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
    this.definitionsLoading.set(true);
    this.workflowApi
      .getDefinitions({
        search: this.definitionSearch() || undefined,
        page: this.definitionsPageIndex(),
        per_page: this.definitionsPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.definitions.set(res.data);
          this.definitionsTotal.set(res.meta?.total ?? res.data.length);
          this.definitionsLoading.set(false);
        },
        error: () => {
          this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_DEFINIZIONI_DI'));
          this.definitionsLoading.set(false);
        },
      });
  }

  protected onDefinitionsTableQueryChange(params: NzTableQueryParams): void {
    this.definitionsPageIndex.set(params.pageIndex);
    this.definitionsPageSize.set(params.pageSize);
    this.loadDefinitions();
  }

  protected openCreateDefModal(): void {
    this.defForm.reset({
      code: '',
      name: '',
      description: '',
      target_entity_type: 'sales_quote',
    });
    this.createDefModalVisible.set(true);
  }

  protected submitCreateDefinition(): void {
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

  protected publishDefinition(def: WorkflowDefinitionResource): void {
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
    this.delegationsLoading.set(true);
    this.workflowApi.getDelegations().subscribe({
      next: (res) => {
        this.delegations.set(res.data);
        this.delegationsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_DELEGHE'));
        this.delegationsLoading.set(false);
      },
    });
  }

  protected openCreateDelegationModal(): void {
    this.delegationForm.reset({
      delegate_user_id: '',
      scope: 'all',
      starts_at: '',
      ends_at: '',
      reason: '',
    });
    this.createDelegationVisible.set(true);
  }

  protected submitCreateDelegation(): void {
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
    this.rulesLoading.set(true);
    this.workflowApi.getEscalationRules().subscribe({
      next: (res) => {
        this.escalationRules.set(res.data);
        this.rulesLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('WORKFLOWS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_REGOLE_DI'));
        this.rulesLoading.set(false);
      },
    });
  }

  protected openCreateRuleModal(): void {
    this.ruleForm.reset({
      name: '',
      reminder_hours: 24,
      escalation_hours: 48,
      escalate_to_type: 'reporting_manager',
      escalate_to_id: '',
    });
    this.createRuleVisible.set(true);
  }

  protected submitCreateRule(): void {
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
