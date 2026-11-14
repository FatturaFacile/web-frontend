import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
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
  GovControl,
  GovernanceApiService,
  GovFinding,
  GovFindingRequest,
  GovMember,
  GovRisk,
  I18nService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { GovernanceAccess } from './governance-access.service';
import { GovActionListComponent } from './gov-action-list.component';
import { GovTransitionChoice, GovTransitionModalComponent } from './gov-transition-modal.component';
import {
  GOV_FINDING_SOURCES,
  GOV_FINDING_TRANSITIONS,
  GOV_NOTES_REQUIRED,
  GOV_SEVERITIES,
  govOptions,
  govSeverityColor,
  govStatusColor,
  govToday,
} from './governance.shared';

/** Audit findings with severity and recommendation, and the remediation actions that fix them. */
@Component({
  selector: 'app-governance-findings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDescriptionsModule,
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
    GovActionListComponent,
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
    .toolbar nz-select,
    .toolbar input {
      min-width: 170px;
    }
    .row-actions {
      display: flex;
      gap: 4px;
    }
    .w-full {
      width: 100%;
    }
    .detail-block {
      margin: 12px 0;
    }
  `,
  template: `
    <app-page-header [title]="'GOVERNANCE.FINDINGS.TITLE' | translate" [subtitle]="'GOVERNANCE.FINDINGS.SUBTITLE' | translate">
      @if (access.canManage()) {
        <button nz-button nzType="primary" appIconAction="create" (click)="openCreate()"></button>
      }
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <input nz-input [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'GOVERNANCE.COMMON.SEARCH' | translate" />
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.COMMON.STATUS' | translate">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'GOVERNANCE.FINDING_STATUS.' + status.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="severityFilter()" (ngModelChange)="severityFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.FINDINGS.SEVERITY' | translate">
          @for (option of severityOptions; track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
          }
        </nz-select>
        <label nz-checkbox [ngModel]="openOnly()" (ngModelChange)="openOnly.set($event); load()">{{ 'GOVERNANCE.FINDINGS.OPEN_ONLY' | translate }}</label>
        <label nz-checkbox [ngModel]="overdueOnly()" (ngModelChange)="overdueOnly.set($event); load()">{{ 'GOVERNANCE.FINDINGS.OVERDUE_ONLY' | translate }}</label>
        <button nz-button (click)="load()"><i class="fa-solid fa-rotate"></i></button>
      </div>

      <nz-table #findingTable [nzData]="findings()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="15">
        <thead>
          <tr>
            <th>{{ 'GOVERNANCE.COMMON.CODE' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
            <th>{{ 'GOVERNANCE.FINDINGS.SEVERITY' | translate }}</th>
            <th>{{ 'GOVERNANCE.FINDINGS.SOURCE' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
            <th>{{ 'GOVERNANCE.FINDINGS.ACTIONS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (finding of findingTable.data; track finding.id) {
            <tr>
              <td>{{ finding.code }}</td>
              <td>{{ finding.title }}</td>
              <td><nz-tag [nzColor]="severityColor(finding.severity)">{{ 'GOVERNANCE.SEVERITY.' + finding.severity.toUpperCase() | translate }}</nz-tag></td>
              <td>{{ 'GOVERNANCE.SOURCE.' + finding.source.toUpperCase() | translate }}</td>
              <td>{{ finding.owner?.name || '-' }}</td>
              <td><nz-tag [nzColor]="statusColor(finding.status)">{{ 'GOVERNANCE.FINDING_STATUS.' + finding.status.toUpperCase() | translate }}</nz-tag></td>
              <td>{{ finding.actions_count ?? 0 }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzSize="small" [title]="'GOVERNANCE.FINDINGS.DETAIL' | translate" (click)="openDetail(finding)"><i class="fa-solid fa-eye"></i></button>
                  @if (access.canManage() && isEditable(finding)) {
                    <button nz-button nzSize="small" appIconAction="edit" (click)="openEdit(finding)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [(nzVisible)]="detailVisible"
      [nzTitle]="detail()?.code ?? ''"
      [nzFooter]="null"
      nzWidth="900px"
      (nzOnCancel)="detailVisible.set(false)"
    >
      <ng-container *nzModalContent>
        @if (detail(); as finding) {
          <nz-descriptions nzSize="small" [nzColumn]="2" nzBordered>
            <nz-descriptions-item [nzTitle]="'GOVERNANCE.COMMON.TITLE' | translate" [nzSpan]="2">{{ finding.title }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GOVERNANCE.FINDINGS.SEVERITY' | translate">
              <nz-tag [nzColor]="severityColor(finding.severity)">{{ 'GOVERNANCE.SEVERITY.' + finding.severity.toUpperCase() | translate }}</nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GOVERNANCE.COMMON.STATUS' | translate">
              <nz-tag [nzColor]="statusColor(finding.status)">{{ 'GOVERNANCE.FINDING_STATUS.' + finding.status.toUpperCase() | translate }}</nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GOVERNANCE.COMMON.OWNER' | translate">{{ finding.owner?.name || '-' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GOVERNANCE.FINDINGS.SOURCE' | translate">{{ 'GOVERNANCE.SOURCE.' + finding.source.toUpperCase() | translate }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GOVERNANCE.COMMON.DESCRIPTION' | translate" [nzSpan]="2">{{ finding.description || '-' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GOVERNANCE.FINDINGS.RECOMMENDATION' | translate" [nzSpan]="2">{{ finding.recommendation || '-' }}</nz-descriptions-item>
            @if (finding.accepted_reason) {
              <nz-descriptions-item [nzTitle]="'GOVERNANCE.FINDINGS.ACCEPTED_REASON' | translate" [nzSpan]="2">{{ finding.accepted_reason }}</nz-descriptions-item>
            }
            @if (finding.closure_notes) {
              <nz-descriptions-item [nzTitle]="'GOVERNANCE.FINDINGS.CLOSURE_NOTES' | translate" [nzSpan]="2">{{ finding.closure_notes }}</nz-descriptions-item>
            }
          </nz-descriptions>

          <div class="detail-block toolbar">
            @if (access.canManage() && detailTargets(finding).length > 0) {
              <button nz-button (click)="openTransition(finding)"><i class="fa-solid fa-right-left"></i> {{ 'GOVERNANCE.TRANSITION.TITLE' | translate }}</button>
            }
            @if (access.canManage() && finding.status !== 'closed' && finding.status !== 'risk_accepted') {
              <button nz-button nzType="primary" (click)="openAction(finding)"><i class="fa-solid fa-plus"></i> {{ 'GOVERNANCE.FINDINGS.ADD_ACTION' | translate }}</button>
            }
          </div>

          <app-gov-action-list [actions]="finding.actions ?? []" [pageSize]="5" (changed)="reloadDetail(finding.id)" />
        }
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="formVisible"
      [nzTitle]="(editing() ? 'GOVERNANCE.FINDINGS.EDIT' : 'GOVERNANCE.FINDINGS.NEW') | translate"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="720px"
      (nzOnCancel)="formVisible.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.FINDINGS.SOURCE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'source')">
                <nz-select formControlName="source" class="w-full">
                  @for (option of sourceOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.FINDINGS.SEVERITY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'severity')">
                <nz-select formControlName="severity" class="w-full">
                  @for (option of severityOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          @if (form.controls.source.value === 'audit') {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.FINDINGS.AUDIT' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'audit_id')">
                <nz-select formControlName="audit_id" nzAllowClear class="w-full">
                  @for (audit of fieldworkAudits(); track audit.id) {
                    <nz-option [nzValue]="audit.id" [nzLabel]="audit.code + ' ' + audit.title"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          @if (form.controls.source.value === 'control_test') {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.FINDINGS.CONTROL' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'control_id')">
                <nz-select formControlName="control_id" nzAllowClear class="w-full">
                  @for (control of controls(); track control.id) {
                    <nz-option [nzValue]="control.id" [nzLabel]="control.code + ' ' + control.title"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(form, 'title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.COMMON.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.FINDINGS.RECOMMENDATION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="recommendation" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'owner_id')">
                <nz-select formControlName="owner_id" nzAllowClear class="w-full">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.FINDINGS.RISK' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'risk_id')">
                <nz-select formControlName="risk_id" nzAllowClear nzShowSearch class="w-full">
                  @for (risk of risks(); track risk.id) {
                    <nz-option [nzValue]="risk.id" [nzLabel]="risk.code + ' ' + risk.title"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="actionVisible"
      [nzTitle]="'GOVERNANCE.FINDINGS.ADD_ACTION' | translate"
      okAction="save"
      [nzOkDisabled]="actionForm.invalid"
      (nzOnCancel)="actionVisible.set(false)"
      (nzOnOk)="saveAction()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="actionForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(actionForm, 'title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.COMMON.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(actionForm, 'owner_id')">
                <nz-select formControlName="owner_id" class="w-full">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.ACTIONS.DUE_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(actionForm, 'due_date')">
                <input nz-input type="date" formControlName="due_date" [min]="today" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <small>{{ 'GOVERNANCE.ACTIONS.TERM_HINT' | translate }}</small>
        </form>
      </ng-container>
    </nz-modal>

    <app-gov-transition-modal
      [(visible)]="transitionVisible"
      statusKeyPrefix="GOVERNANCE.FINDING_STATUS"
      [targets]="transitionTargets()"
      [notesRequiredFor]="notesRequiredFor"
      (confirmed)="applyTransition($event)"
    />
  `,
})
export class GovernanceFindingsComponent implements OnInit {
  protected readonly access = inject(GovernanceAccess);
  private readonly api = inject(GovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly statuses = ['open', 'remediation', 'resolved', 'closed', 'risk_accepted'];
  protected readonly severityOptions = govOptions('GOVERNANCE.SEVERITY', GOV_SEVERITIES);
  protected readonly sourceOptions = govOptions('GOVERNANCE.SOURCE', GOV_FINDING_SOURCES);
  protected readonly notesRequiredFor = GOV_NOTES_REQUIRED['finding'];
  protected readonly severityColor = govSeverityColor;
  protected readonly statusColor = govStatusColor;
  protected readonly today = govToday();

  protected readonly findings = signal<GovFinding[]>([]);
  protected readonly loading = signal(false);
  protected readonly members = signal<GovMember[]>([]);
  protected readonly audits = signal<GovAudit[]>([]);
  protected readonly controls = signal<GovControl[]>([]);
  protected readonly risks = signal<GovRisk[]>([]);
  protected readonly fieldworkAudits = computed(() => this.audits().filter((audit) => audit.status === 'in_progress' || audit.status === 'reporting'));
  protected readonly search = signal('');
  protected readonly statusFilter = signal<string | null>(null);
  protected readonly severityFilter = signal<string | null>(null);
  protected readonly openOnly = signal(false);
  protected readonly overdueOnly = signal(false);

  protected readonly detail = signal<GovFinding | null>(null);
  protected readonly detailVisible = signal(false);
  protected readonly formVisible = signal(false);
  protected readonly actionVisible = signal(false);
  protected readonly editing = signal<GovFinding | null>(null);
  protected readonly transitionVisible = signal(false);
  protected readonly transitionTargets = signal<readonly string[]>([]);

  protected readonly form = this.fb.group({
    source: ['self_assessment', [Validators.required]],
    audit_id: [null as string | null],
    control_id: [null as string | null],
    risk_id: [null as string | null],
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
    severity: ['medium', [Validators.required]],
    recommendation: [''],
    owner_id: [null as string | null],
  });

  protected readonly actionForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
    owner_id: ['', [Validators.required]],
    due_date: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
    this.api.getMembers().subscribe({ next: (res) => this.members.set(res.data) });
    this.api.getAudits({ per_page: 100 }).subscribe({ next: (res) => this.audits.set(res.data) });
    this.api.getControls({ per_page: 100 }).subscribe({ next: (res) => this.controls.set(res.data) });
    this.api.getRisks({ per_page: 100 }).subscribe({ next: (res) => this.risks.set(res.data) });
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getFindings({
        per_page: 100,
        status: this.statusFilter() ?? undefined,
        severity: this.severityFilter() ?? undefined,
        search: this.search() || undefined,
        open: this.openOnly() ? 1 : undefined,
        overdue: this.overdueOnly() ? 1 : undefined,
      })
      .subscribe({
        next: (res) => {
          this.findings.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  isEditable(finding: GovFinding): boolean {
    return finding.status === 'open' || finding.status === 'remediation' || finding.status === 'resolved';
  }

  /** The manual changes of a finding the member may make: accepting a risk and closing a serious one are decisions. */
  detailTargets(finding: GovFinding): readonly string[] {
    return GOV_FINDING_TRANSITIONS[finding.status].filter((target) => {
      const decision = target === 'risk_accepted' || (target === 'closed' && (finding.severity === 'high' || finding.severity === 'critical'));
      return !decision || this.access.canApprove();
    });
  }

  errorTip(form: { get(path: string): { errors: Record<string, unknown> | null } | null }, path: string): string {
    const errors = form.get(path)?.errors;
    if (errors?.['serverError']) {
      return String(errors['serverError']);
    }
    return errors?.['required'] ? this.i18n.translate('COMMON.VALIDATION.REQUIRED') : '';
  }

  openDetail(finding: GovFinding): void {
    this.reloadDetail(finding.id, true);
  }

  reloadDetail(id: string, open = false): void {
    this.api.getFinding(id).subscribe({
      next: (res) => {
        this.detail.set(res.data);
        if (open) {
          this.detailVisible.set(true);
        }
        this.load();
      },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ source: 'self_assessment', audit_id: null, control_id: null, risk_id: null, title: '', description: '', severity: 'medium', recommendation: '', owner_id: null });
    this.formVisible.set(true);
  }

  openEdit(finding: GovFinding): void {
    this.editing.set(finding);
    this.form.reset({
      source: finding.source,
      audit_id: finding.audit_id ?? null,
      control_id: finding.control_id ?? null,
      risk_id: finding.risk_id ?? null,
      title: finding.title,
      description: finding.description ?? '',
      severity: finding.severity,
      recommendation: finding.recommendation ?? '',
      owner_id: finding.owner_id ?? null,
    });
    this.formVisible.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const editing = this.editing();
    const payload: GovFindingRequest = {
      source: value.source as GovFindingRequest['source'],
      audit_id: value.source === 'audit' ? value.audit_id : null,
      control_id: value.source === 'control_test' ? value.control_id : null,
      risk_id: value.risk_id,
      title: value.title,
      description: value.description || null,
      severity: value.severity as GovFindingRequest['severity'],
      recommendation: value.recommendation || null,
      owner_id: value.owner_id,
    };
    const request = editing
      ? this.api.updateFinding(editing.id, { title: payload.title, description: payload.description, severity: payload.severity, recommendation: payload.recommendation, owner_id: payload.owner_id, risk_id: payload.risk_id })
      : this.api.createFinding(payload);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.formVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.showErrors(this.form, error),
    });
  }

  openAction(finding: GovFinding): void {
    this.detail.set(finding);
    this.actionForm.reset({ title: '', description: '', owner_id: finding.owner_id ?? '', due_date: '' });
    this.actionVisible.set(true);
  }

  saveAction(): void {
    const finding = this.detail();
    if (finding === null || this.actionForm.invalid) {
      return;
    }
    const value = this.actionForm.getRawValue();
    this.api
      .createFindingAction(finding.id, { title: value.title, description: value.description || null, owner_id: value.owner_id, due_date: value.due_date })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
          this.actionVisible.set(false);
          this.reloadDetail(finding.id);
        },
        error: (error: unknown) => this.showErrors(this.actionForm, error),
      });
  }

  openTransition(finding: GovFinding): void {
    this.detail.set(finding);
    this.transitionTargets.set(this.detailTargets(finding));
    this.transitionVisible.set(true);
  }

  applyTransition(choice: GovTransitionChoice): void {
    const finding = this.detail();
    if (finding === null) {
      return;
    }
    this.api.transitionFinding(finding.id, { status: choice.status, notes: choice.notes }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.reloadDetail(finding.id);
      },
      error: (error: unknown) => this.showErrors(this.form, error),
    });
  }

  private showErrors(form: Parameters<typeof applyServerErrors>[0], error: unknown): void {
    const unmapped = applyServerErrors(form, error);
    const text = unmapped[0] ?? (error as { error?: { message?: string } })?.error?.message;
    if (text) {
      this.message.error(text);
    }
  }
}
