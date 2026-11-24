import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  AuthStore,
  I18nService,
  ProcurementApiService,
  ProcurementSupplier,
  serverErrorMessage,
  SupplierBankChange,
  SupplierBankChangeStatus,
  SupplierPortalApiService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { ibanValidator } from '@shared/utils/iban-validator';
import { validationTipKey } from '@shared/utils/validation-tip';
import { BANK_STATUS_COLORS, BANK_STATUS_LABELS, formatIban } from './supplier-portal.utils';

/** The steps a reviewer takes on a bank detail change, each of them with a text. */
type BankStep = 'verify-callback' | 'approve' | 'reject';

/** Anti-fraud approvals of bank detail changes: callback to the supplier, then two approvals by people other than the requester. */
@Component({
  selector: 'app-supplier-bank-changes',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'SUPPLIER_PORTAL.PAGE_BANK_CHANGES' | translate" [subtitle]="'SUPPLIER_PORTAL.BANK_CHANGES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openRequest()">{{ 'SUPPLIER_PORTAL.NEW_BANK_CHANGE' | translate }}</button>
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="setStatusFilter($event)" nzAllowClear [nzPlaceHolder]="'SUPPLIER_PORTAL.ALL_STATUSES' | translate" class="filter">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="statusLabels[status] | translate"></nz-option>
          }
        </nz-select>
      </div>

      <nz-table #table [nzData]="changes()" [nzLoading]="loading()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.NEW_IBAN' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.PREVIOUS_IBAN' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.SOURCE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.STATUS' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.CALLBACK' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.APPROVALS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (change of table.data; track change.id) {
            <tr>
              <td>
                {{ change.supplier_name }}
                <div class="holder">{{ change.account_holder }}</div>
              </td>
              <td class="iban">{{ formatIban(change.iban) }}</td>
              <td class="iban">{{ formatIban(change.previous_iban) }}</td>
              <td>{{ (change.source === 'portal' ? 'SUPPLIER_PORTAL.SOURCE_PORTAL' : 'SUPPLIER_PORTAL.SOURCE_INTERNAL') | translate }}</td>
              <td>
                <nz-tag [nzColor]="statusColors[change.status]">{{ statusLabels[change.status] | translate }}</nz-tag>
                @if (change.rejection_reason) {
                  <div class="holder">{{ change.rejection_reason }}</div>
                }
              </td>
              <td>
                @if (change.callback_verified_at) {
                  <nz-tag nzColor="green">{{ change.callback_verified_at | date: 'dd/MM/yyyy HH:mm' }}</nz-tag>
                } @else {
                  <nz-tag>{{ 'SUPPLIER_PORTAL.NOT_VERIFIED' | translate }}</nz-tag>
                }
              </td>
              <td>{{ approvedCount(change) }} / {{ change.approvals_required }}</td>
              <td class="row-actions">
                @if (change.status === 'pending') {
                  @if (!isRequester(change)) {
                    @if (!change.callback_verified_at) {
                      <button nz-button nzSize="small" (click)="openStep(change, 'verify-callback')">{{ 'SUPPLIER_PORTAL.VERIFY_CALLBACK' | translate }}</button>
                    } @else if (!hasDecided(change)) {
                      <button nz-button nzSize="small" nzType="primary" (click)="openStep(change, 'approve')">{{ 'SUPPLIER_PORTAL.APPROVE' | translate }}</button>
                    }
                    @if (!hasDecided(change)) {
                      <button nz-button nzSize="small" nzDanger (click)="openStep(change, 'reject')">{{ 'SUPPLIER_PORTAL.REJECT' | translate }}</button>
                    }
                  }
                  <button nz-button nzSize="small" (click)="cancel(change)">{{ 'SUPPLIER_PORTAL.CANCEL_REQUEST' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal appModalActions
      [nzVisible]="stepVisible()"
      [nzTitle]="stepTitleKey() | translate"
      (nzOnCancel)="stepVisible.set(false)"
      (nzOnOk)="confirmStep()"
      [nzOkDisabled]="stepForm.invalid"
      [nzOkDanger]="step() === 'reject'"
    >
      <ng-container *nzModalContent>
        @if (selected(); as change) {
          <p class="iban">{{ formatIban(change.iban) }} - {{ change.account_holder }}</p>
        }
        <form nz-form nzLayout="vertical" [formGroup]="stepForm">
          <nz-form-item>
            <nz-form-label [nzRequired]="step() !== 'approve'">{{ stepLabelKey() | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(stepForm, 'text')">
              <textarea nz-input rows="3" formControlName="text"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [nzVisible]="requestVisible()"
      [nzTitle]="'SUPPLIER_PORTAL.NEW_BANK_CHANGE' | translate"
      (nzOnCancel)="requestVisible.set(false)"
      (nzOnOk)="saveRequest()"
      okAction="create"
      [nzOkDisabled]="requestForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="requestForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(requestForm, 'supplier_id')">
              <nz-select formControlName="supplier_id" nzShowSearch>
                @for (supplier of suppliers(); track supplier.id) {
                  <nz-option [nzValue]="supplier.id" [nzLabel]="supplier.company_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.ACCOUNT_HOLDER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(requestForm, 'account_holder')">
              <input nz-input formControlName="account_holder" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>IBAN</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(requestForm, 'iban')">
              <input nz-input formControlName="iban" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>BIC</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="bic" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'SUPPLIER_PORTAL.BANK_NAME' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="bank_name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'SUPPLIER_PORTAL.REASON' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input rows="2" formControlName="reason"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      margin-bottom: 12px;
    }
    .filter {
      min-width: 200px;
    }
    .iban {
      font-family: monospace;
    }
    .holder {
      font-size: 12px;
      opacity: 0.75;
    }
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
})
export class SupplierBankChangesComponent implements OnInit {
  private readonly api = inject(SupplierPortalApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly authStore = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly changes = signal<SupplierBankChange[]>([]);
  readonly suppliers = signal<ProcurementSupplier[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<SupplierBankChangeStatus | null>('pending');
  readonly selected = signal<SupplierBankChange | null>(null);
  readonly step = signal<BankStep>('approve');
  readonly stepVisible = signal(false);
  readonly requestVisible = signal(false);

  readonly stepForm = this.fb.group({ text: [''] });
  readonly requestForm = this.fb.group({
    supplier_id: ['', Validators.required],
    account_holder: ['', Validators.required],
    iban: ['', [Validators.required, ibanValidator]],
    bic: [''],
    bank_name: [''],
    reason: [''],
  });

  readonly statuses = Object.keys(BANK_STATUS_LABELS) as SupplierBankChangeStatus[];
  readonly statusLabels = BANK_STATUS_LABELS;
  readonly statusColors = BANK_STATUS_COLORS;
  readonly formatIban = formatIban;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getBankChanges({ status: this.statusFilter() ?? undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.changes.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
        },
      });
  }

  setStatusFilter(status: SupplierBankChangeStatus | null): void {
    this.statusFilter.set(status);
    this.load();
  }

  approvedCount(change: SupplierBankChange): number {
    return (change.approvals ?? []).filter((approval) => approval.decision === 'approved').length;
  }

  isRequester(change: SupplierBankChange): boolean {
    return change.requested_by !== null && change.requested_by !== undefined && change.requested_by === this.authStore.user()?.id;
  }

  hasDecided(change: SupplierBankChange): boolean {
    const userId = this.authStore.user()?.id;
    return (change.approvals ?? []).some((approval) => approval.user_id === userId);
  }

  stepTitleKey(): string {
    return { 'verify-callback': 'SUPPLIER_PORTAL.VERIFY_CALLBACK', approve: 'SUPPLIER_PORTAL.APPROVE', reject: 'SUPPLIER_PORTAL.REJECT' }[this.step()];
  }

  stepLabelKey(): string {
    return { 'verify-callback': 'SUPPLIER_PORTAL.CALLBACK_NOTE', approve: 'SUPPLIER_PORTAL.COMMENT', reject: 'SUPPLIER_PORTAL.REASON' }[this.step()];
  }

  openStep(change: SupplierBankChange, step: BankStep): void {
    this.selected.set(change);
    this.step.set(step);
    this.stepForm.reset({ text: '' });
    this.stepForm.controls.text.setValidators(step === 'approve' ? [] : [Validators.required]);
    this.stepForm.controls.text.updateValueAndValidity();
    this.stepVisible.set(true);
  }

  confirmStep(): void {
    const change = this.selected();
    if (!change || this.stepForm.invalid) {
      return;
    }
    const text = this.stepForm.getRawValue().text.trim();
    const request$ = {
      'verify-callback': () => this.api.verifyBankChangeCallback(change.id, { note: text }),
      approve: () => this.api.approveBankChange(change.id, { comment: text || null }),
      reject: () => this.api.rejectBankChange(change.id, { reason: text }),
    }[this.step()]();

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.stepVisible.set(false);
        this.message.success(this.translate.instant(response.data.status === 'applied' ? 'SUPPLIER_PORTAL.BANK_CHANGE_APPLIED' : 'SUPPLIER_PORTAL.STEP_DONE'));
        this.load();
      },
      error: (error: unknown) => this.fail(this.stepForm, error),
    });
  }

  cancel(change: SupplierBankChange): void {
    this.api
      .cancelBankChange(change.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.STEP_DONE'));
          this.load();
        },
        error: () => this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR')),
      });
  }

  openRequest(): void {
    this.requestForm.reset({ supplier_id: '', account_holder: '', iban: '', bic: '', bank_name: '', reason: '' });
    this.requestVisible.set(true);
    if (this.suppliers().length === 0) {
      this.procurement
        .getSuppliers({ per_page: 100 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (response) => this.suppliers.set(response.data) });
    }
  }

  saveRequest(): void {
    if (this.requestForm.invalid) {
      return;
    }
    const value = this.requestForm.getRawValue();
    this.api
      .createBankChange({ ...value, bic: value.bic || null, bank_name: value.bank_name || null, reason: value.reason || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.requestVisible.set(false);
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.BANK_CHANGE_REQUESTED'));
          this.load();
        },
        error: (error: unknown) => this.fail(this.requestForm, error),
      });
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

  private fail(form: FormGroup, error: unknown): void {
    const body = (error as { error?: { detail?: string; message?: string } })?.error;
    this.message.error(body?.detail ?? body?.message ?? this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
    form.markAllAsTouched();
  }
}
