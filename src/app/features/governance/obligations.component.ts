import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  DmsApiService,
  DmsDocumentResource,
  GovDashboard,
  GovernanceApiService,
  GovFramework,
  GovMember,
  GovObligation,
  GovObligationRequest,
  I18nService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { GovernanceAccess } from './governance-access.service';
import { GovTransitionChoice, GovTransitionModalComponent } from './gov-transition-modal.component';
import {
  GOV_FRAMEWORKS,
  GOV_JURISDICTIONS,
  GOV_OBLIGATION_TRANSITIONS,
  GOV_RECURRENCES,
  govOptions,
  govStatusColor,
  govToday,
} from './governance.shared';

/** The frameworks of the seeded templates, preselected by the jurisdiction of the company. */
export function govDefaultFrameworks(jurisdiction: string | null | undefined): GovFramework[] {
  return jurisdiction === 'CH' ? ['fadp', 'iso_27001'] : ['d_lgs_231', 'gdpr', 'nis2', 'iso_27001'];
}

/** Compliance obligations calendar: D.Lgs. 231/2001, GDPR, NIS2, Swiss FADP and ISO 27001, seeded from templates. */
@Component({
  selector: 'app-governance-obligations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    GovTransitionModalComponent,
  ],
  styles: `
    .gov-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
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
    .overdue {
      color: #cf1322;
    }
    .soon {
      color: #d46b08;
    }
    .w-full {
      width: 100%;
    }
    .header-actions {
      display: flex;
      gap: 8px;
    }
  `,
  template: `
    <app-page-header [title]="'GOVERNANCE.OBLIGATIONS.TITLE' | translate" [subtitle]="'GOVERNANCE.OBLIGATIONS.SUBTITLE' | translate">
      @if (access.canManage()) {
        <div class="header-actions">
          <button nz-button (click)="openSeed()"><i class="fa-solid fa-wand-magic-sparkles"></i> {{ 'GOVERNANCE.OBLIGATIONS.SEED' | translate }}</button>
          <button nz-button nzType="primary" appIconAction="create" (click)="openCreate()"></button>
        </div>
      }
    </app-page-header>

    @if (dashboard(); as board) {
      <div class="gov-kpis">
        <nz-card><nz-statistic [nzValue]="board.obligations.open" [nzTitle]="'GOVERNANCE.OBLIGATIONS.OPEN' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.obligations.overdue" [nzTitle]="'GOVERNANCE.OBLIGATIONS.OVERDUE' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.obligations.due_next_30_days" [nzTitle]="'GOVERNANCE.OBLIGATIONS.DUE_NEXT_30' | translate"></nz-statistic></nz-card>
      </div>
    }

    <nz-card>
      <div class="toolbar">
        <input nz-input [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'GOVERNANCE.COMMON.SEARCH' | translate" />
        <nz-select [ngModel]="frameworkFilter()" (ngModelChange)="frameworkFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.OBLIGATIONS.FRAMEWORK' | translate">
          @for (option of frameworkOptions; track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.COMMON.STATUS' | translate">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'GOVERNANCE.OBLIGATION_STATUS.' + status.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
        <label nz-checkbox [ngModel]="overdueOnly()" (ngModelChange)="overdueOnly.set($event); load()">{{ 'GOVERNANCE.OBLIGATIONS.OVERDUE_ONLY' | translate }}</label>
        <button nz-button (click)="load()"><i class="fa-solid fa-rotate"></i></button>
      </div>

      <nz-table #obligationTable [nzData]="obligations()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="15">
        <thead>
          <tr>
            <th>{{ 'GOVERNANCE.OBLIGATIONS.DUE_DATE' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
            <th>{{ 'GOVERNANCE.OBLIGATIONS.FRAMEWORK' | translate }}</th>
            <th>{{ 'GOVERNANCE.OBLIGATIONS.RECURRENCE' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
            <th>{{ 'GOVERNANCE.OBLIGATIONS.LAST_COMPLETED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (obligation of obligationTable.data; track obligation.id) {
            <tr>
              <td [class.overdue]="obligation.is_overdue" [class.soon]="obligation.is_due_soon">{{ obligation.due_date | date: 'dd/MM/yyyy' }}</td>
              <td>
                {{ obligation.title }}
                @if (obligation.legal_reference) {
                  <div><small>{{ obligation.legal_reference }}</small></div>
                }
              </td>
              <td>
                {{ 'GOVERNANCE.FRAMEWORK.' + obligation.framework.toUpperCase() | translate }}
                <nz-tag>{{ obligation.jurisdiction }}</nz-tag>
              </td>
              <td>{{ 'GOVERNANCE.RECURRENCE.' + obligation.recurrence.toUpperCase() | translate }}</td>
              <td>{{ obligation.owner?.name || '-' }}</td>
              <td><nz-tag [nzColor]="statusColor(obligation.status)">{{ 'GOVERNANCE.OBLIGATION_STATUS.' + obligation.status.toUpperCase() | translate }}</nz-tag></td>
              <td>{{ obligation.last_completed_at ? (obligation.last_completed_at | date: 'dd/MM/yyyy') : '-' }}</td>
              <td>
                <div class="row-actions">
                  @if (access.canWrite() && isOpen(obligation)) {
                    <button nz-button nzSize="small" nzType="primary" [title]="'GOVERNANCE.OBLIGATIONS.COMPLETE' | translate" (click)="openComplete(obligation)"><i class="fa-solid fa-check"></i></button>
                  }
                  @if (access.canManage()) {
                    @if (isOpen(obligation)) {
                      <button nz-button nzSize="small" appIconAction="edit" (click)="openEdit(obligation)"></button>
                    }
                    @if (nextStatuses(obligation).length > 0) {
                      <button nz-button nzSize="small" [title]="'GOVERNANCE.TRANSITION.TITLE' | translate" (click)="openTransition(obligation)"><i class="fa-solid fa-right-left"></i></button>
                    }
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [(nzVisible)]="formVisible"
      [nzTitle]="(editing() ? 'GOVERNANCE.OBLIGATIONS.EDIT' : 'GOVERNANCE.OBLIGATIONS.NEW') | translate"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="720px"
      (nzOnCancel)="formVisible.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(form, 'title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.OBLIGATIONS.FRAMEWORK' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'framework')">
                <nz-select formControlName="framework" class="w-full">
                  @for (option of frameworkOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.OBLIGATIONS.JURISDICTION' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'jurisdiction')">
                <nz-select formControlName="jurisdiction" class="w-full">
                  @for (option of jurisdictionOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.value"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.OBLIGATIONS.LEGAL_REFERENCE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="legal_reference" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.COMMON.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="2" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.OBLIGATIONS.RECURRENCE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'recurrence')">
                <nz-select formControlName="recurrence" class="w-full">
                  @for (option of recurrenceOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.OBLIGATIONS.DUE_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'due_date')"><input nz-input type="date" formControlName="due_date" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.OBLIGATIONS.REMINDER_DAYS' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'reminder_days')"><input nz-input type="number" min="0" max="365" formControlName="reminder_days" /></nz-form-control>
            </nz-form-item>
          </div>
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
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="completeVisible"
      [nzTitle]="'GOVERNANCE.OBLIGATIONS.COMPLETE' | translate"
      okAction="confirm"
      [nzOkDisabled]="completeForm.invalid"
      (nzOnCancel)="completeVisible.set(false)"
      (nzOnOk)="saveComplete()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="completeForm">
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.OBLIGATIONS.COMPLETED_ON' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(completeForm, 'completed_on')"><input nz-input type="date" formControlName="completed_on" [max]="today" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.CONTROLS.EVIDENCE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(completeForm, 'evidence_document_id')">
              <nz-select formControlName="evidence_document_id" nzAllowClear nzShowSearch class="w-full">
                @for (document of documents(); track document.id) {
                  <nz-option [nzValue]="document.id" [nzLabel]="document.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.COMMON.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="3" formControlName="notes" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="seedVisible"
      [nzTitle]="'GOVERNANCE.OBLIGATIONS.SEED' | translate"
      okAction="confirm"
      [nzOkDisabled]="seedForm.invalid"
      (nzOnCancel)="seedVisible.set(false)"
      (nzOnOk)="saveSeed()"
    >
      <ng-container *nzModalContent>
        <p>{{ 'GOVERNANCE.OBLIGATIONS.SEED_HINT' | translate }}</p>
        <form nz-form nzLayout="vertical" [formGroup]="seedForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.OBLIGATIONS.FRAMEWORKS' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(seedForm, 'frameworks')">
              <nz-select formControlName="frameworks" nzMode="multiple" class="w-full">
                @for (option of seedFrameworkOptions; track option.value) {
                  <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.OBLIGATIONS.FIRST_DUE_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(seedForm, 'first_due_date')"><input nz-input type="date" formControlName="first_due_date" [min]="today" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(seedForm, 'owner_id')">
                <nz-select formControlName="owner_id" nzAllowClear class="w-full">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <app-gov-transition-modal
      [(visible)]="transitionVisible"
      statusKeyPrefix="GOVERNANCE.OBLIGATION_STATUS"
      [targets]="transitionTargets()"
      (confirmed)="applyTransition($event)"
    />
  `,
})
export class GovernanceObligationsComponent implements OnInit {
  protected readonly access = inject(GovernanceAccess);
  private readonly api = inject(GovernanceApiService);
  private readonly dms = inject(DmsApiService);
  private readonly authStore = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly statuses = Object.keys(GOV_OBLIGATION_TRANSITIONS);
  protected readonly frameworkOptions = govOptions('GOVERNANCE.FRAMEWORK', GOV_FRAMEWORKS);
  protected readonly seedFrameworkOptions = this.frameworkOptions.filter((option) => option.value !== 'other');
  protected readonly jurisdictionOptions = govOptions('GOVERNANCE.JURISDICTION', GOV_JURISDICTIONS);
  protected readonly recurrenceOptions = govOptions('GOVERNANCE.RECURRENCE', GOV_RECURRENCES);
  protected readonly statusColor = govStatusColor;
  protected readonly today = govToday();

  protected readonly obligations = signal<GovObligation[]>([]);
  protected readonly dashboard = signal<GovDashboard | null>(null);
  protected readonly members = signal<GovMember[]>([]);
  protected readonly documents = signal<DmsDocumentResource[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  protected readonly frameworkFilter = signal<string | null>(null);
  protected readonly statusFilter = signal<string | null>(null);
  protected readonly overdueOnly = signal(false);

  protected readonly formVisible = signal(false);
  protected readonly completeVisible = signal(false);
  protected readonly seedVisible = signal(false);
  protected readonly transitionVisible = signal(false);
  protected readonly transitionTargets = signal<readonly string[]>([]);
  protected readonly editing = signal<GovObligation | null>(null);
  private readonly selected = signal<GovObligation | null>(null);

  protected readonly form = this.fb.group({
    framework: ['gdpr', [Validators.required]],
    jurisdiction: ['EU', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
    legal_reference: [''],
    recurrence: ['annual', [Validators.required]],
    due_date: ['', [Validators.required]],
    reminder_days: [30, [Validators.min(0), Validators.max(365)]],
    owner_id: [null as string | null],
  });

  protected readonly completeForm = this.fb.group({
    completed_on: [govToday()],
    evidence_document_id: [null as string | null],
    notes: [''],
  });

  protected readonly seedForm = this.fb.group({
    frameworks: [[] as string[], [Validators.required, Validators.minLength(1)]],
    first_due_date: [''],
    owner_id: [null as string | null],
  });

  ngOnInit(): void {
    this.reload();
    this.api.getMembers().subscribe({ next: (res) => this.members.set(res.data) });
    this.dms.getDocuments({ per_page: 100 }).subscribe({ next: (res) => this.documents.set(res.data), error: () => undefined });
  }

  reload(): void {
    this.load();
    this.api.getDashboard().subscribe({ next: (res) => this.dashboard.set(res.data) });
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getObligations({
        per_page: 100,
        framework: this.frameworkFilter() ?? undefined,
        status: this.statusFilter() ?? undefined,
        search: this.search() || undefined,
        overdue: this.overdueOnly() ? 1 : undefined,
      })
      .subscribe({
        next: (res) => {
          this.obligations.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  isOpen(obligation: GovObligation): boolean {
    return obligation.status === 'pending' || obligation.status === 'in_progress';
  }

  nextStatuses(obligation: GovObligation): readonly string[] {
    return GOV_OBLIGATION_TRANSITIONS[obligation.status];
  }

  errorTip(form: { get(path: string): { errors: Record<string, unknown> | null } | null }, path: string): string {
    const errors = form.get(path)?.errors;
    if (errors?.['serverError']) {
      return String(errors['serverError']);
    }
    return errors?.['required'] ? this.i18n.translate('COMMON.VALIDATION.REQUIRED') : '';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ framework: 'gdpr', jurisdiction: 'EU', title: '', description: '', legal_reference: '', recurrence: 'annual', due_date: '', reminder_days: 30, owner_id: null });
    this.formVisible.set(true);
  }

  openEdit(obligation: GovObligation): void {
    this.editing.set(obligation);
    this.form.reset({
      framework: obligation.framework,
      jurisdiction: obligation.jurisdiction,
      title: obligation.title,
      description: obligation.description ?? '',
      legal_reference: obligation.legal_reference ?? '',
      recurrence: obligation.recurrence,
      due_date: obligation.due_date,
      reminder_days: obligation.reminder_days,
      owner_id: obligation.owner_id ?? null,
    });
    this.formVisible.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: GovObligationRequest = {
      framework: value.framework as GovObligationRequest['framework'],
      jurisdiction: value.jurisdiction as GovObligationRequest['jurisdiction'],
      title: value.title,
      description: value.description || null,
      legal_reference: value.legal_reference || null,
      recurrence: value.recurrence as GovObligationRequest['recurrence'],
      due_date: value.due_date,
      reminder_days: value.reminder_days,
      owner_id: value.owner_id,
    };
    const editing = this.editing();
    const request = editing ? this.api.updateObligation(editing.id, payload) : this.api.createObligation(payload);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.formVisible.set(false);
        this.reload();
      },
      error: (error: unknown) => this.showErrors(this.form, error),
    });
  }

  openComplete(obligation: GovObligation): void {
    this.selected.set(obligation);
    this.completeForm.reset({ completed_on: govToday(), evidence_document_id: obligation.evidence_document_id ?? null, notes: '' });
    this.completeVisible.set(true);
  }

  saveComplete(): void {
    const obligation = this.selected();
    if (obligation === null) {
      return;
    }
    const value = this.completeForm.getRawValue();
    this.api
      .completeObligation(obligation.id, {
        completed_on: value.completed_on || null,
        evidence_document_id: value.evidence_document_id,
        notes: value.notes || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
          this.completeVisible.set(false);
          this.reload();
        },
        error: (error: unknown) => this.showErrors(this.completeForm, error),
      });
  }

  openSeed(): void {
    this.seedForm.reset({ frameworks: govDefaultFrameworks(this.authStore.activeJurisdiction()), first_due_date: '', owner_id: null });
    this.seedVisible.set(true);
  }

  saveSeed(): void {
    if (this.seedForm.invalid) {
      this.seedForm.markAllAsTouched();
      return;
    }
    const value = this.seedForm.getRawValue();
    this.api
      .seedObligationTemplates({
        frameworks: value.frameworks as GovFramework[],
        first_due_date: value.first_due_date || null,
        owner_id: value.owner_id,
      })
      .subscribe({
        next: (res) => {
          this.message.success(this.translate.instant('GOVERNANCE.OBLIGATIONS.SEEDED', { created: res.data.created, skipped: res.data.skipped }));
          this.seedVisible.set(false);
          this.reload();
        },
        error: (error: unknown) => this.showErrors(this.seedForm, error),
      });
  }

  openTransition(obligation: GovObligation): void {
    this.selected.set(obligation);
    this.transitionTargets.set(this.nextStatuses(obligation));
    this.transitionVisible.set(true);
  }

  applyTransition(choice: GovTransitionChoice): void {
    const obligation = this.selected();
    if (obligation === null) {
      return;
    }
    this.api.transitionObligation(obligation.id, { status: choice.status, notes: choice.notes }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.reload();
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
