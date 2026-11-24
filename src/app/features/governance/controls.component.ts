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
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  DmsApiService,
  DmsDocumentResource,
  GovControl,
  GovControlRequest,
  GovControlTest,
  GovControlTestRequest,
  GovernanceApiService,
  GovMember,
  I18nService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { GovernanceAccess } from './governance-access.service';
import { GovTransitionChoice, GovTransitionModalComponent } from './gov-transition-modal.component';
import {
  GOV_CONTROL_TRANSITIONS,
  GOV_CONTROL_TYPES,
  GOV_FREQUENCIES,
  GOV_TEST_RESULTS,
  govOptions,
  govStatusColor,
  govTestResultColor,
  govToday,
} from './governance.shared';

/** Controls library: type, frequency, owner, test schedule and the tests with their DMS evidence. */
@Component({
  selector: 'app-governance-controls',
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
      color: var(--ff-color-danger);
    }
    .w-full {
      width: 100%;
    }
  `,
  template: `
    <app-page-header [title]="'GOVERNANCE.CONTROLS.TITLE' | translate" [subtitle]="'GOVERNANCE.CONTROLS.SUBTITLE' | translate">
      @if (access.canManage()) {
        <button nz-button nzType="primary" appIconAction="create" (click)="openCreate()"></button>
      }
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <input nz-input [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'GOVERNANCE.COMMON.SEARCH' | translate" />
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.COMMON.STATUS' | translate">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'GOVERNANCE.CONTROL_STATUS.' + status.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.CONTROLS.TYPE' | translate">
          @for (option of typeOptions; track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
          }
        </nz-select>
        <label for="controls-field" nzId="controls-field" nz-checkbox [ngModel]="overdueOnly()" (ngModelChange)="overdueOnly.set($event); load()">{{ 'GOVERNANCE.CONTROLS.TEST_OVERDUE' | translate }}</label>
        <button nz-button (click)="load()"><i class="fa-solid fa-rotate"></i></button>
      </div>

      <nz-table #controlTable [nzData]="controls()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="15">
        <thead>
          <tr>
            <th>{{ 'GOVERNANCE.COMMON.CODE' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
            <th>{{ 'GOVERNANCE.CONTROLS.TYPE' | translate }}</th>
            <th>{{ 'GOVERNANCE.CONTROLS.FREQUENCY' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</th>
            <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
            <th>{{ 'GOVERNANCE.CONTROLS.LAST_TEST' | translate }}</th>
            <th>{{ 'GOVERNANCE.CONTROLS.NEXT_TEST' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (control of controlTable.data; track control.id) {
            <tr>
              <td>{{ control.code }}</td>
              <td>
                {{ control.title }}
                @if (control.framework_reference) {
                  <div><small>{{ control.framework_reference }}</small></div>
                }
              </td>
              <td>{{ 'GOVERNANCE.CONTROL_TYPE.' + control.control_type.toUpperCase() | translate }}</td>
              <td>{{ 'GOVERNANCE.FREQUENCY.' + control.frequency.toUpperCase() | translate }}</td>
              <td>{{ control.owner?.name || '-' }}</td>
              <td><nz-tag [nzColor]="statusColor(control.status)">{{ 'GOVERNANCE.CONTROL_STATUS.' + control.status.toUpperCase() | translate }}</nz-tag></td>
              <td>
                @if (control.last_tested_at) {
                  {{ control.last_tested_at | date: 'dd/MM/yyyy' }}
                  <nz-tag [nzColor]="resultColor(control.last_test_result)">{{ 'GOVERNANCE.TEST_RESULT.' + (control.last_test_result ?? '').toUpperCase() | translate }}</nz-tag>
                } @else {
                  -
                }
              </td>
              <td [class.overdue]="control.is_test_overdue">{{ control.next_test_due_date ? (control.next_test_due_date | date: 'dd/MM/yyyy') : '-' }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzSize="small" [title]="'GOVERNANCE.CONTROLS.TESTS' | translate" (click)="openHistory(control)"><i class="fa-solid fa-clock-rotate-left"></i></button>
                  @if (access.canManage()) {
                    @if (control.status === 'active') {
                      <button nz-button nzSize="small" nzType="primary" [title]="'GOVERNANCE.CONTROLS.RECORD_TEST' | translate" (click)="openTest(control)"><i class="fa-solid fa-clipboard-check"></i></button>
                    }
                    <button nz-button nzSize="small" appIconAction="edit" (click)="openEdit(control)"></button>
                    @if (nextStatuses(control).length > 0) {
                      <button nz-button nzSize="small" [title]="'GOVERNANCE.TRANSITION.TITLE' | translate" (click)="openTransition(control)"><i class="fa-solid fa-right-left"></i></button>
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
      [(nzVisible)]="formVisible"
      [nzTitle]="(editing() ? 'GOVERNANCE.CONTROLS.EDIT' : 'GOVERNANCE.CONTROLS.NEW') | translate"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="640px"
      (nzOnCancel)="formVisible.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(form, 'title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.COMMON.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="2" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.CONTROLS.TYPE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'control_type')">
                <nz-select formControlName="control_type" class="w-full">
                  @for (option of typeOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.CONTROLS.FREQUENCY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(form, 'frequency')">
                <nz-select formControlName="frequency" class="w-full">
                  @for (option of frequencyOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
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
              <nz-form-label>{{ 'GOVERNANCE.CONTROLS.FRAMEWORK_REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="framework_reference" maxlength="120" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [(nzVisible)]="testVisible"
      [nzTitle]="'GOVERNANCE.CONTROLS.RECORD_TEST' | translate"
      okAction="save"
      [nzOkDisabled]="testForm.invalid"
      nzWidth="640px"
      (nzOnCancel)="testVisible.set(false)"
      (nzOnOk)="saveTest()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="testForm">
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.CONTROLS.TESTED_ON' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(testForm, 'tested_on')"><input nz-input type="date" formControlName="tested_on" [max]="today" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.CONTROLS.RESULT' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(testForm, 'result')">
                <nz-select formControlName="result" class="w-full">
                  @for (option of resultOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.CONTROLS.SAMPLE_SIZE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(testForm, 'sample_size')"><input nz-input type="number" min="1" formControlName="sample_size" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.CONTROLS.EXCEPTIONS_FOUND' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(testForm, 'exceptions_found')"><input nz-input type="number" min="0" formControlName="exceptions_found" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.CONTROLS.EVIDENCE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(testForm, 'evidence_document_ids')">
              <nz-select formControlName="evidence_document_ids" nzMode="multiple" nzShowSearch class="w-full">
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
          @if (testForm.controls.result.value !== 'pass') {
            <label for="controls-raise-finding" nzId="controls-raise-finding" nz-checkbox formControlName="raise_finding">{{ 'GOVERNANCE.CONTROLS.RAISE_FINDING' | translate }}</label>
          }
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [(nzVisible)]="historyVisible"
      [nzTitle]="'GOVERNANCE.CONTROLS.TESTS' | translate"
      [nzFooter]="null"
      nzWidth="720px"
      (nzOnCancel)="historyVisible.set(false)"
    >
      <ng-container *nzModalContent>
        <nz-table #historyTable [nzData]="tests()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GOVERNANCE.CONTROLS.TESTED_ON' | translate }}</th>
              <th>{{ 'GOVERNANCE.CONTROLS.RESULT' | translate }}</th>
              <th>{{ 'GOVERNANCE.CONTROLS.SAMPLE_SIZE' | translate }}</th>
              <th>{{ 'GOVERNANCE.CONTROLS.EXCEPTIONS_FOUND' | translate }}</th>
              <th>{{ 'GOVERNANCE.CONTROLS.EVIDENCE' | translate }}</th>
              <th>{{ 'GOVERNANCE.CONTROLS.TESTER' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (test of historyTable.data; track test.id) {
              <tr>
                <td>{{ test.tested_on | date: 'dd/MM/yyyy' }}</td>
                <td><nz-tag [nzColor]="resultColor(test.result)">{{ 'GOVERNANCE.TEST_RESULT.' + test.result.toUpperCase() | translate }}</nz-tag></td>
                <td>{{ test.sample_size ?? '-' }}</td>
                <td>{{ test.exceptions_found ?? '-' }}</td>
                <td>{{ test.evidence_document_ids.length }}</td>
                <td>{{ test.tester?.name || '-' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>

    <app-gov-transition-modal
      [(visible)]="transitionVisible"
      statusKeyPrefix="GOVERNANCE.CONTROL_STATUS"
      [targets]="transitionTargets()"
      (confirmed)="applyTransition($event)"
    />
  `,
})
export class GovernanceControlsComponent implements OnInit {
  protected readonly access = inject(GovernanceAccess);
  private readonly api = inject(GovernanceApiService);
  private readonly dms = inject(DmsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly statuses = Object.keys(GOV_CONTROL_TRANSITIONS);
  protected readonly typeOptions = govOptions('GOVERNANCE.CONTROL_TYPE', GOV_CONTROL_TYPES);
  protected readonly frequencyOptions = govOptions('GOVERNANCE.FREQUENCY', GOV_FREQUENCIES);
  protected readonly resultOptions = govOptions('GOVERNANCE.TEST_RESULT', GOV_TEST_RESULTS);
  protected readonly statusColor = govStatusColor;
  protected readonly resultColor = govTestResultColor;
  protected readonly today = govToday();

  protected readonly controls = signal<GovControl[]>([]);
  protected readonly loading = signal(false);
  protected readonly members = signal<GovMember[]>([]);
  protected readonly documents = signal<DmsDocumentResource[]>([]);
  protected readonly tests = signal<GovControlTest[]>([]);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<string | null>(null);
  protected readonly typeFilter = signal<string | null>(null);
  protected readonly overdueOnly = signal(false);

  protected readonly formVisible = signal(false);
  protected readonly testVisible = signal(false);
  protected readonly historyVisible = signal(false);
  protected readonly transitionVisible = signal(false);
  protected readonly transitionTargets = signal<readonly string[]>([]);
  protected readonly editing = signal<GovControl | null>(null);
  private readonly selected = signal<GovControl | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
    control_type: ['preventive', [Validators.required]],
    frequency: ['monthly', [Validators.required]],
    framework_reference: [''],
    owner_id: [null as string | null],
  });

  protected readonly testForm = this.fb.group({
    tested_on: [govToday(), [Validators.required]],
    result: ['pass', [Validators.required]],
    sample_size: [null as number | null, [Validators.min(1)]],
    exceptions_found: [null as number | null, [Validators.min(0)]],
    evidence_document_ids: [[] as string[]],
    notes: [''],
    raise_finding: [false],
  });

  ngOnInit(): void {
    this.load();
    this.api.getMembers().subscribe({ next: (res) => this.members.set(res.data) });
    this.dms.getDocuments({ per_page: 100 }).subscribe({ next: (res) => this.documents.set(res.data), error: () => undefined });
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getControls({
        per_page: 100,
        status: this.statusFilter() ?? undefined,
        control_type: this.typeFilter() ?? undefined,
        search: this.search() || undefined,
        test_overdue: this.overdueOnly() ? 1 : undefined,
      })
      .subscribe({
        next: (res) => {
          this.controls.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  nextStatuses(control: GovControl): readonly string[] {
    return GOV_CONTROL_TRANSITIONS[control.status];
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
    this.form.reset({ title: '', description: '', control_type: 'preventive', frequency: 'monthly', framework_reference: '', owner_id: null });
    this.formVisible.set(true);
  }

  openEdit(control: GovControl): void {
    this.editing.set(control);
    this.form.reset({
      title: control.title,
      description: control.description ?? '',
      control_type: control.control_type,
      frequency: control.frequency,
      framework_reference: control.framework_reference ?? '',
      owner_id: control.owner_id ?? null,
    });
    this.formVisible.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: GovControlRequest = {
      title: value.title,
      description: value.description || null,
      control_type: value.control_type as GovControlRequest['control_type'],
      frequency: value.frequency as GovControlRequest['frequency'],
      framework_reference: value.framework_reference || null,
      owner_id: value.owner_id,
    };
    const editing = this.editing();
    const request = editing ? this.api.updateControl(editing.id, payload) : this.api.createControl(payload);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.formVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.showErrors(this.form, error),
    });
  }

  openTransition(control: GovControl): void {
    this.selected.set(control);
    this.transitionTargets.set(this.nextStatuses(control));
    this.transitionVisible.set(true);
  }

  applyTransition(choice: GovTransitionChoice): void {
    const control = this.selected();
    if (control === null) {
      return;
    }
    this.api.updateControl(control.id, { status: choice.status as GovControl['status'] }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.load();
      },
      error: (error: unknown) => this.showErrors(this.form, error),
    });
  }

  openTest(control: GovControl): void {
    this.selected.set(control);
    this.testForm.reset({ tested_on: govToday(), result: 'pass', sample_size: null, exceptions_found: null, evidence_document_ids: [], notes: '', raise_finding: false });
    this.testVisible.set(true);
  }

  saveTest(): void {
    const control = this.selected();
    if (control === null || this.testForm.invalid) {
      return;
    }
    const value = this.testForm.getRawValue();
    const payload: GovControlTestRequest = {
      tested_on: value.tested_on,
      result: value.result as GovControlTestRequest['result'],
      sample_size: value.sample_size,
      exceptions_found: value.exceptions_found,
      evidence_document_ids: value.evidence_document_ids.length > 0 ? value.evidence_document_ids : null,
      notes: value.notes || null,
      raise_finding: value.result !== 'pass' && value.raise_finding,
    };
    this.api.recordControlTest(control.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.testVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.showErrors(this.testForm, error),
    });
  }

  openHistory(control: GovControl): void {
    this.tests.set([]);
    this.api.getControlTests(control.id).subscribe({
      next: (res) => {
        this.tests.set(res.data);
        this.historyVisible.set(true);
      },
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
