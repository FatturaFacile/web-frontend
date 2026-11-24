import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  GovAudit,
  GovAuditPlan,
  GovAuditRequest,
  GovernanceApiService,
  GovMember,
  I18nService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { GovernanceAccess } from './governance-access.service';
import { GovTransitionChoice, GovTransitionModalComponent } from './gov-transition-modal.component';
import {
  GOV_AUDIT_PLAN_TRANSITIONS,
  GOV_AUDIT_TRANSITIONS,
  GOV_AUDIT_TYPES,
  GOV_NOTES_REQUIRED,
  govOptions,
  govStatusColor,
} from './governance.shared';

type TransitionTarget = { kind: 'plan'; plan: GovAuditPlan } | { kind: 'audit'; audit: GovAudit };

/** Annual internal audit plan with its audits: scope, lead auditor, team, dates and the fieldwork status flow. */
@Component({
  selector: 'app-governance-audits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    GovTransitionModalComponent,
  ],
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .toolbar nz-select {
      min-width: 200px;
    }
    .row-actions {
      display: flex;
      gap: 4px;
    }
    .late {
      color: var(--ff-color-danger);
    }
    .w-full {
      width: 100%;
    }
    nz-card + nz-card {
      margin-top: 16px;
    }
  `,
  template: `
    <app-page-header [title]="'GOVERNANCE.AUDITS.TITLE' | translate" [subtitle]="'GOVERNANCE.AUDITS.SUBTITLE' | translate"></app-page-header>

    <nz-card [nzTitle]="'GOVERNANCE.AUDITS.PLANS' | translate" [nzExtra]="planExtra">
      <ng-template #planExtra>
        @if (access.canManage()) {
          <button nz-button nzType="primary" appIconAction="create" (click)="openPlanCreate()"></button>
        }
      </ng-template>
      <nz-table #planTable [nzData]="plans()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'GOVERNANCE.AUDITS.YEAR' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
            <th>{{ 'GOVERNANCE.AUDITS.AUDITS_COUNT' | translate }}</th>
            <th>{{ 'GOVERNANCE.AUDITS.APPROVED_BY' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (plan of planTable.data; track plan.id) {
            <tr>
              <td>{{ plan.year }}</td>
              <td>{{ plan.title }}</td>
              <td><nz-tag [nzColor]="statusColor(plan.status)">{{ 'GOVERNANCE.PLAN_STATUS.' + plan.status.toUpperCase() | translate }}</nz-tag></td>
              <td>{{ plan.audits_count ?? 0 }}</td>
              <td>{{ plan.approved_by?.name || '-' }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzSize="small" [title]="'GOVERNANCE.AUDITS.SHOW_AUDITS' | translate" (click)="planFilter.set(planFilter() === plan.id ? null : plan.id); loadAudits()"><i class="fa-solid fa-filter"></i></button>
                  @if (access.canManage() && plan.status !== 'closed') {
                    <button nz-button nzSize="small" appIconAction="edit" (click)="openPlanEdit(plan)"></button>
                  }
                  @if (planTargets(plan).length > 0 && access.canApprove()) {
                    <button nz-button nzSize="small" [title]="'GOVERNANCE.TRANSITION.TITLE' | translate" (click)="openTransition({ kind: 'plan', plan })"><i class="fa-solid fa-right-left"></i></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'GOVERNANCE.AUDITS.AUDITS' | translate" [nzExtra]="auditExtra">
      <ng-template #auditExtra>
        @if (access.canManage()) {
          <button nz-button nzType="primary" appIconAction="create" (click)="openAuditCreate()"></button>
        }
      </ng-template>
      <div class="toolbar">
        <nz-select [ngModel]="planFilter()" (ngModelChange)="planFilter.set($event); loadAudits()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.AUDITS.PLAN' | translate">
          @for (plan of plans(); track plan.id) {
            <nz-option [nzValue]="plan.id" [nzLabel]="plan.year + ' - ' + plan.title"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); loadAudits()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.COMMON.STATUS' | translate">
          @for (status of auditStatuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'GOVERNANCE.AUDIT_STATUS.' + status.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
      </div>
      <nz-table #auditTable [nzData]="audits()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="15">
        <thead>
          <tr>
            <th>{{ 'GOVERNANCE.COMMON.CODE' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
            <th>{{ 'GOVERNANCE.AUDITS.TYPE' | translate }}</th>
            <th>{{ 'GOVERNANCE.AUDITS.LEAD_AUDITOR' | translate }}</th>
            <th>{{ 'GOVERNANCE.AUDITS.PLANNED' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
            <th>{{ 'GOVERNANCE.AUDITS.FINDINGS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (audit of auditTable.data; track audit.id) {
            <tr>
              <td>{{ audit.code }}</td>
              <td>
                {{ audit.title }}
                <div><small>{{ audit.scope }}</small></div>
              </td>
              <td>{{ 'GOVERNANCE.AUDIT_TYPE.' + audit.audit_type.toUpperCase() | translate }}</td>
              <td>{{ audit.lead_auditor?.name || '-' }}</td>
              <td [class.late]="audit.is_late_to_start">{{ audit.planned_start | date: 'dd/MM/yyyy' }} - {{ audit.planned_end | date: 'dd/MM/yyyy' }}</td>
              <td><nz-tag [nzColor]="statusColor(audit.status)">{{ 'GOVERNANCE.AUDIT_STATUS.' + audit.status.toUpperCase() | translate }}</nz-tag></td>
              <td>{{ audit.findings_count ?? 0 }}</td>
              <td>
                <div class="row-actions">
                  @if (access.canManage()) {
                    @if (audit.status !== 'closed' && audit.status !== 'cancelled') {
                      <button nz-button nzSize="small" appIconAction="edit" (click)="openAuditEdit(audit)"></button>
                    }
                    @if (auditTargets(audit).length > 0) {
                      <button nz-button nzSize="small" [title]="'GOVERNANCE.TRANSITION.TITLE' | translate" (click)="openTransition({ kind: 'audit', audit })"><i class="fa-solid fa-right-left"></i></button>
                    }
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="planFormVisible"
      [nzTitle]="(editingPlan() ? 'GOVERNANCE.AUDITS.EDIT_PLAN' : 'GOVERNANCE.AUDITS.NEW_PLAN') | translate"
      okAction="save"
      [nzOkDisabled]="planForm.invalid"
      (nzOnCancel)="planFormVisible.set(false)"
      (nzOnOk)="savePlan()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="planForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.AUDITS.YEAR' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(planForm, 'year')"><input nz-input type="number" min="2000" max="2100" formControlName="year" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(planForm, 'title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.COMMON.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [(nzVisible)]="auditFormVisible"
      [nzTitle]="(editingAudit() ? 'GOVERNANCE.AUDITS.EDIT_AUDIT' : 'GOVERNANCE.AUDITS.NEW_AUDIT') | translate"
      okAction="save"
      [nzOkDisabled]="auditForm.invalid"
      nzWidth="720px"
      (nzOnCancel)="auditFormVisible.set(false)"
      (nzOnOk)="saveAudit()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="auditForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(auditForm, 'title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.AUDITS.PLAN' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(auditForm, 'audit_plan_id')">
                <nz-select formControlName="audit_plan_id" nzAllowClear class="w-full">
                  @for (plan of openPlans(); track plan.id) {
                    <nz-option [nzValue]="plan.id" [nzLabel]="plan.year + ' - ' + plan.title"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.AUDITS.TYPE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(auditForm, 'audit_type')">
                <nz-select formControlName="audit_type" class="w-full">
                  @for (option of typeOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.AUDITS.SCOPE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(auditForm, 'scope')"><textarea nz-input rows="2" formControlName="scope" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.AUDITS.OBJECTIVES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="2" formControlName="objectives" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.AUDITS.LEAD_AUDITOR' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(auditForm, 'lead_auditor_id')">
                <nz-select formControlName="lead_auditor_id" class="w-full">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.AUDITS.TEAM' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(auditForm, 'team_member_ids')">
                <nz-select formControlName="team_member_ids" nzMode="multiple" class="w-full">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.AUDITS.PLANNED_START' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(auditForm, 'planned_start')"><input nz-input type="date" formControlName="planned_start" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.AUDITS.PLANNED_END' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(auditForm, 'planned_end')"><input nz-input type="date" formControlName="planned_end" /></nz-form-control>
            </nz-form-item>
          </div>
          @if (editingAudit() && editingAudit()?.status !== 'planned') {
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.AUDITS.CONCLUSION' | translate }}</nz-form-label>
              <nz-form-control><textarea nz-input rows="3" formControlName="conclusion" maxlength="8000"></textarea></nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>

    <app-gov-transition-modal
      [(visible)]="transitionVisible"
      [statusKeyPrefix]="transitionPrefix()"
      [targets]="transitionTargets()"
      [notesRequiredFor]="transitionNotes()"
      (confirmed)="applyTransition($event)"
    />
  `,
})
export class GovernanceAuditsComponent implements OnInit {
  protected readonly access = inject(GovernanceAccess);
  private readonly api = inject(GovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly typeOptions = govOptions('GOVERNANCE.AUDIT_TYPE', GOV_AUDIT_TYPES);
  protected readonly auditStatuses = Object.keys(GOV_AUDIT_TRANSITIONS);
  protected readonly statusColor = govStatusColor;

  protected readonly plans = signal<GovAuditPlan[]>([]);
  protected readonly audits = signal<GovAudit[]>([]);
  protected readonly members = signal<GovMember[]>([]);
  protected readonly loading = signal(false);
  protected readonly planFilter = signal<string | null>(null);
  protected readonly statusFilter = signal<string | null>(null);
  protected readonly openPlans = computed(() => this.plans().filter((plan) => plan.status !== 'closed'));

  protected readonly planFormVisible = signal(false);
  protected readonly auditFormVisible = signal(false);
  protected readonly editingPlan = signal<GovAuditPlan | null>(null);
  protected readonly editingAudit = signal<GovAudit | null>(null);
  protected readonly transitionVisible = signal(false);
  protected readonly transitionTargets = signal<readonly string[]>([]);
  protected readonly transitionPrefix = signal('GOVERNANCE.AUDIT_STATUS');
  protected readonly transitionNotes = signal<readonly string[]>([]);
  private readonly target = signal<TransitionTarget | null>(null);

  protected readonly planForm = this.fb.group({
    year: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
  });

  protected readonly auditForm = this.fb.group({
    audit_plan_id: [null as string | null],
    title: ['', [Validators.required, Validators.maxLength(190)]],
    audit_type: ['process', [Validators.required]],
    scope: ['', [Validators.required, Validators.maxLength(4000)]],
    objectives: [''],
    lead_auditor_id: ['', [Validators.required]],
    team_member_ids: [[] as string[]],
    planned_start: ['', [Validators.required]],
    planned_end: ['', [Validators.required]],
    conclusion: [''],
  });

  ngOnInit(): void {
    this.loadPlans();
    this.loadAudits();
    this.api.getMembers().subscribe({ next: (res) => this.members.set(res.data) });
  }

  loadPlans(): void {
    this.api.getAuditPlans({ per_page: 50 }).subscribe({ next: (res) => this.plans.set(res.data) });
  }

  loadAudits(): void {
    this.loading.set(true);
    this.api
      .getAudits({
        per_page: 100,
        audit_plan_id: this.planFilter() ?? undefined,
        status: this.statusFilter() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.audits.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  planTargets(plan: GovAuditPlan): readonly string[] {
    return GOV_AUDIT_PLAN_TRANSITIONS[plan.status];
  }

  auditTargets(audit: GovAudit): readonly string[] {
    return GOV_AUDIT_TRANSITIONS[audit.status];
  }

  errorTip(form: { get(path: string): { errors: Record<string, unknown> | null } | null }, path: string): string {
    const errors = form.get(path)?.errors;
    if (errors?.['serverError']) {
      return String(errors['serverError']);
    }
    return errors?.['required'] ? this.i18n.translate('COMMON.VALIDATION.REQUIRED') : '';
  }

  openPlanCreate(): void {
    this.editingPlan.set(null);
    this.planForm.reset({ year: new Date().getFullYear(), title: '', description: '' });
    this.planFormVisible.set(true);
  }

  openPlanEdit(plan: GovAuditPlan): void {
    this.editingPlan.set(plan);
    this.planForm.reset({ year: plan.year, title: plan.title, description: plan.description ?? '' });
    this.planFormVisible.set(true);
  }

  savePlan(): void {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }
    const value = this.planForm.getRawValue();
    const payload = { year: value.year, title: value.title, description: value.description || null };
    const editing = this.editingPlan();
    const request = editing ? this.api.updateAuditPlan(editing.id, payload) : this.api.createAuditPlan(payload);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.planFormVisible.set(false);
        this.loadPlans();
      },
      error: (error: unknown) => this.showErrors(this.planForm, error),
    });
  }

  openAuditCreate(): void {
    this.editingAudit.set(null);
    this.auditForm.reset({
      audit_plan_id: this.planFilter(),
      title: '',
      audit_type: 'process',
      scope: '',
      objectives: '',
      lead_auditor_id: '',
      team_member_ids: [],
      planned_start: '',
      planned_end: '',
      conclusion: '',
    });
    this.auditFormVisible.set(true);
  }

  openAuditEdit(audit: GovAudit): void {
    this.editingAudit.set(audit);
    this.auditForm.reset({
      audit_plan_id: audit.audit_plan_id ?? null,
      title: audit.title,
      audit_type: audit.audit_type,
      scope: audit.scope,
      objectives: audit.objectives ?? '',
      lead_auditor_id: audit.lead_auditor_id,
      team_member_ids: audit.team_member_ids,
      planned_start: audit.planned_start,
      planned_end: audit.planned_end,
      conclusion: audit.conclusion ?? '',
    });
    this.auditFormVisible.set(true);
  }

  saveAudit(): void {
    if (this.auditForm.invalid) {
      this.auditForm.markAllAsTouched();
      return;
    }
    const value = this.auditForm.getRawValue();
    const editing = this.editingAudit();
    const started = editing !== null && editing.status !== 'planned';
    const payload: Partial<GovAuditRequest> = started
      ? { team_member_ids: value.team_member_ids, conclusion: value.conclusion || null }
      : {
          audit_plan_id: value.audit_plan_id,
          title: value.title,
          audit_type: value.audit_type as GovAuditRequest['audit_type'],
          scope: value.scope,
          objectives: value.objectives || null,
          lead_auditor_id: value.lead_auditor_id,
          team_member_ids: value.team_member_ids,
          planned_start: value.planned_start,
          planned_end: value.planned_end,
        };
    const request = editing ? this.api.updateAudit(editing.id, payload) : this.api.createAudit(payload as GovAuditRequest);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.auditFormVisible.set(false);
        this.loadAudits();
        this.loadPlans();
      },
      error: (error: unknown) => this.showErrors(this.auditForm, error),
    });
  }

  openTransition(target: TransitionTarget): void {
    this.target.set(target);
    if (target.kind === 'plan') {
      this.transitionPrefix.set('GOVERNANCE.PLAN_STATUS');
      this.transitionTargets.set(this.planTargets(target.plan));
      this.transitionNotes.set([]);
    } else {
      this.transitionPrefix.set('GOVERNANCE.AUDIT_STATUS');
      this.transitionTargets.set(this.auditTargets(target.audit));
      this.transitionNotes.set(GOV_NOTES_REQUIRED['audit']);
    }
    this.transitionVisible.set(true);
  }

  applyTransition(choice: GovTransitionChoice): void {
    const target = this.target();
    if (target === null) {
      return;
    }
    const payload = { status: choice.status, notes: choice.notes };
    const observer = {
      next: (): void => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.loadPlans();
        this.loadAudits();
      },
      error: (error: unknown): void => this.showErrors(this.auditForm, error),
    };

    if (target.kind === 'plan') {
      this.api.transitionAuditPlan(target.plan.id, payload).subscribe(observer);
    } else {
      this.api.transitionAudit(target.audit.id, payload).subscribe(observer);
    }
  }

  private showErrors(form: Parameters<typeof applyServerErrors>[0], error: unknown): void {
    const unmapped = applyServerErrors(form, error);
    const text = unmapped[0] ?? (error as { error?: { message?: string } })?.error?.message;
    if (text) {
      this.message.error(text);
    }
  }
}
