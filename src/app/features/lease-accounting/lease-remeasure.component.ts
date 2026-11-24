import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  applyServerErrors,
  I18nService,
  LEASE_REMEASURE_REASONS,
  LeaseAccountingApiService,
  LeaseContract,
  LeaseRemeasureReason,
  LeaseRemeasureRequest,
  LeaseScheduleLine,
  LeaseScheduleVersion,
  serverErrorMessage,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { validationTipKey } from '@shared/utils/validation-tip';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const RATE_PATTERN = /^\d{1,3}(\.\d{1,6})?$/;

/** Required only for the reasons that need the field (mirrors `required_if` of `RemeasureLeaseRequest`). */
function requiredForReasons(reasons: readonly LeaseRemeasureReason[]) {
  return (control: AbstractControl): ValidationErrors | null => {
    const reason = control.parent?.get('reason')?.value as LeaseRemeasureReason | undefined;
    const empty = control.value === null || control.value === undefined || control.value === '';
    return reason !== undefined && reasons.includes(reason) && empty ? { required: true } : null;
  };
}

/**
 * Remeasurement of an active lease from a period start on: modification, index change or reassessment of the term.
 * It writes a new schedule version; the periods that are posted already are never touched.
 */
@Component({
  selector: 'app-lease-remeasure',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzInputNumberModule, NzModalModule, NzSelectModule, NzSwitchModule, ModalActionsDirective, TranslatePipe],
  template: `
    <nz-modal appModalActions
      [nzVisible]="visible()"
      [nzTitle]="'LEASES.REMEASURE_TITLE' | translate"
      (nzOnCancel)="visible.set(false)"
      (nzOnOk)="save()"
      [nzOkDisabled]="form.invalid || periodStarts().length === 0"
      [nzOkLoading]="saving()"
      okAction="confirm"
      nzWidth="620px"
    >
      <ng-container *nzModalContent>
        <p>{{ 'LEASES.REMEASURE_HINT_' + form.controls.reason.value | translate }}</p>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'LEASES.FIELD.reason' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('reason')">
              <nz-select formControlName="reason">
                @for (value of reasons; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="'LEASES.REASON_' + value | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'LEASES.FIELD.effective_date' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('effective_date')">
              <nz-select formControlName="effective_date" [nzPlaceHolder]="'LEASES.FIELD.effective_date' | translate">
                @for (date of periodStarts(); track date) {
                  <nz-option [nzValue]="date" [nzLabel]="date"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label [nzRequired]="form.controls.reason.value === 'index_change'" nzFor="lease-new-payment">{{ 'LEASES.FIELD.new_payment_amount' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('new_payment_amount')">
              <input nz-input id="lease-new-payment" formControlName="new_payment_amount" inputmode="decimal" placeholder="0.00" />
            </nz-form-control>
          </nz-form-item>
          @if (form.controls.reason.value !== 'index_change') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="lease-new-rate">{{ 'LEASES.FIELD.new_discount_rate_percent' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('new_discount_rate_percent')">
                <input nz-input id="lease-new-rate" formControlName="new_discount_rate_percent" inputmode="decimal" placeholder="4.500000" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="lease-remaining-term">{{ 'LEASES.FIELD.remaining_term_months' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('remaining_term_months')">
                <nz-input-number id="lease-remaining-term" formControlName="remaining_term_months" [nzMin]="1" [nzPrecision]="0" />
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label>{{ 'LEASES.FIELD.post_journal' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-switch formControlName="post_journal" [attr.aria-label]="'LEASES.FIELD.post_journal' | translate" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="lease-remeasure-notes">{{ 'LEASES.FIELD.notes' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('notes')">
              <textarea nz-input id="lease-remeasure-notes" formControlName="notes" rows="2" maxlength="4000"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class LeaseRemeasureComponent {
  private readonly api = inject(LeaseAccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly visible = model(false);
  readonly lease = input.required<LeaseContract>();
  /** The schedule in force: the effective date is one of the starts of its periods that are not posted yet. */
  readonly schedule = input<LeaseScheduleLine[]>([]);
  readonly remeasured = output<LeaseScheduleVersion>();

  protected readonly reasons = LEASE_REMEASURE_REASONS;
  protected readonly saving = signal(false);
  protected readonly periodStarts = computed(() =>
    this.schedule()
      .filter((line) => line.status === 'scheduled')
      .map((line) => line.period_start),
  );

  protected readonly form = this.fb.group({
    reason: ['index_change' as LeaseRemeasureReason, [Validators.required]],
    effective_date: ['', [Validators.required]],
    new_payment_amount: ['', [requiredForReasons(['index_change']), Validators.pattern(AMOUNT_PATTERN)]],
    remaining_term_months: [null as number | null, [Validators.min(1)]],
    new_discount_rate_percent: ['', [requiredForReasons(['modification', 'reassessment']), Validators.pattern(RATE_PATTERN)]],
    post_journal: [true],
    notes: ['', [Validators.maxLength(4000)]],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset();
      }
    });

    this.form.controls.reason.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.form.controls.new_payment_amount.updateValueAndValidity({ emitEvent: false });
      this.form.controls.new_discount_rate_percent.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(this.form as unknown as FormGroup, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const text = (input: string): string | null => (input === '' ? null : input);
    const isIndex = value.reason === 'index_change';
    const payload: LeaseRemeasureRequest = {
      effective_date: value.effective_date,
      reason: value.reason,
      new_payment_amount: text(value.new_payment_amount),
      remaining_term_months: isIndex ? null : value.remaining_term_months,
      new_discount_rate_percent: isIndex ? null : text(value.new_discount_rate_percent),
      post_journal: value.post_journal,
      notes: text(value.notes),
    };

    this.saving.set(true);
    this.api.remeasureContract(this.lease().id, payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('LEASES.MSG_REMEASURED'));
        this.visible.set(false);
        this.remeasured.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form as unknown as FormGroup, err);
        this.message.error(unmapped[0] ?? this.i18n.translate('LEASES.MSG_ERROR'));
      },
    });
  }
}
