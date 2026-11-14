import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
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
  LEASE_ASSET_CLASSES,
  LEASE_CURRENCIES,
  LEASE_ESCALATION_TYPES,
  LEASE_EXEMPTIONS,
  LEASE_FREQUENCY_MONTHS,
  LEASE_PAYMENT_FREQUENCIES,
  LEASE_PAYMENT_TIMINGS,
  LEASE_STANDARDS,
  LeaseAccountingApiService,
  LeaseContract,
  LeaseContractRequest,
  serverErrorMessage,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { validationTipKey } from '@shared/utils/validation-tip';

/** Amount with up to two decimals (API rule `decimal:0,2`). */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
/** Rate in percent with up to six decimals (API rule `decimal:0,6`, between 0 and 100). */
const RATE_PATTERN = /^\d{1,3}(\.\d{1,6})?$/;
const MAX_TERM_MONTHS = 600;

type LeaseFormValues = ReturnType<LeaseFormComponent['buildForm']>['value'];

/** Required only while the predicate holds on the other controls of the form. */
function requiredWhen(predicate: (values: Record<string, unknown>) => boolean): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const values = control.parent?.getRawValue() as Record<string, unknown> | undefined;
    const empty = control.value === null || control.value === undefined || control.value === '';
    return values && predicate(values) && empty ? { required: true } : null;
  };
}

/** Mirrors the API rule: the term (with the extension that is reasonably certain) is a whole number of payment periods. */
const termMultipleOfFrequency: ValidatorFn = (control) => {
  const values = control.parent?.getRawValue() as Record<string, unknown> | undefined;
  const term = Number(control.value);
  if (!values || !Number.isInteger(term) || term < 1) {
    return null;
  }
  const extension = values['extension_reasonably_certain'] ? Number(values['extension_months'] ?? 0) : 0;
  const frequency = LEASE_FREQUENCY_MONTHS[values['payment_frequency'] as keyof typeof LEASE_FREQUENCY_MONTHS] ?? 1;
  return (term + extension) % frequency === 0 ? null : { termMultiple: true };
};

const amountOrEmpty = (control: AbstractControl): ValidationErrors | null =>
  !control.value || AMOUNT_PATTERN.test(String(control.value)) ? null : { pattern: true };

/** Create or change a draft lease: the terms of the contract, mirroring `LeaseContractRequest`. */
@Component({
  selector: 'app-lease-form',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    ModalActionsDirective,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="(lease() ? 'LEASES.EDIT_TITLE' : 'LEASES.NEW_TITLE') | translate"
      (nzOnCancel)="visible.set(false)"
      (nzOnOk)="save()"
      [nzOkDisabled]="form.invalid"
      [nzOkLoading]="saving()"
      okAction="save"
      nzWidth="860px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <h4>{{ 'LEASES.SECTION_CONTRACT' | translate }}</h4>
          <div class="grid">
            <nz-form-item class="span-2">
              <nz-form-label nzRequired nzFor="lease-title">{{ 'LEASES.FIELD.title' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('title')">
                <input nz-input id="lease-title" formControlName="title" maxlength="190" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="lease-lessor">{{ 'LEASES.FIELD.lessor_name' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('lessor_name')">
                <input nz-input id="lease-lessor" formControlName="lessor_name" maxlength="190" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'LEASES.FIELD.asset_class' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('asset_class')">
                <nz-select formControlName="asset_class" [nzPlaceHolder]="'LEASES.FIELD.asset_class' | translate">
                  @for (value of assetClasses; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'LEASES.ASSET_CLASS_' + value | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'LEASES.FIELD.accounting_standard' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('accounting_standard')">
                <nz-select formControlName="accounting_standard">
                  @for (value of standards; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'LEASES.STANDARD_' + value | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'LEASES.FIELD.currency' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('currency')">
                <nz-select formControlName="currency">
                  @for (value of currencies; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="value"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item class="span-2">
              <nz-form-label nzFor="lease-asset-description">{{ 'LEASES.FIELD.asset_description' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('asset_description')">
                <textarea nz-input id="lease-asset-description" formControlName="asset_description" rows="2" maxlength="2000"></textarea>
              </nz-form-control>
            </nz-form-item>
          </div>

          <h4>{{ 'LEASES.SECTION_PAYMENTS' | translate }}</h4>
          <div class="grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="lease-commencement">{{ 'LEASES.FIELD.commencement_date' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('commencement_date')">
                <input nz-input id="lease-commencement" type="date" formControlName="commencement_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="lease-term">{{ 'LEASES.FIELD.term_months' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('term_months')">
                <nz-input-number id="lease-term" formControlName="term_months" [nzMin]="1" [nzMax]="maxTermMonths" [nzStep]="1" [nzPrecision]="0" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="lease-payment">{{ 'LEASES.FIELD.payment_amount' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('payment_amount')">
                <input nz-input id="lease-payment" formControlName="payment_amount" inputmode="decimal" placeholder="0.00" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'LEASES.FIELD.payment_frequency' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('payment_frequency')">
                <nz-select formControlName="payment_frequency">
                  @for (value of frequencies; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'LEASES.FREQUENCY_' + value | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'LEASES.FIELD.payment_timing' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('payment_timing')">
                <nz-select formControlName="payment_timing">
                  @for (value of timings; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'LEASES.TIMING_' + value | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="lease-ibr">{{ 'LEASES.FIELD.incremental_borrowing_rate_percent' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('incremental_borrowing_rate_percent')">
                <input nz-input id="lease-ibr" formControlName="incremental_borrowing_rate_percent" inputmode="decimal" placeholder="4.500000" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'LEASES.FIELD.escalation_type' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('escalation_type')">
                <nz-select formControlName="escalation_type">
                  @for (value of escalationTypes; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'LEASES.ESCALATION_' + value | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            @if (form.controls.escalation_type.value === 'fixed') {
              <nz-form-item>
                <nz-form-label nzFor="lease-escalation">{{ 'LEASES.FIELD.escalation_rate_percent' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="errorTip('escalation_rate_percent')">
                  <input nz-input id="lease-escalation" formControlName="escalation_rate_percent" inputmode="decimal" placeholder="2.000000" />
                </nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-label nzFor="lease-idc">{{ 'LEASES.FIELD.initial_direct_costs' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('initial_direct_costs')">
                <input nz-input id="lease-idc" formControlName="initial_direct_costs" inputmode="decimal" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="lease-incentives">{{ 'LEASES.FIELD.incentives_received' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('incentives_received')">
                <input nz-input id="lease-incentives" formControlName="incentives_received" inputmode="decimal" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <h4>{{ 'LEASES.SECTION_OPTIONS' | translate }}</h4>
          <div class="grid">
            <nz-form-item>
              <nz-form-label>{{ 'LEASES.FIELD.extension_reasonably_certain' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-switch formControlName="extension_reasonably_certain" [attr.aria-label]="'LEASES.FIELD.extension_reasonably_certain' | translate" />
              </nz-form-control>
            </nz-form-item>
            @if (form.controls.extension_reasonably_certain.value) {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="lease-extension">{{ 'LEASES.FIELD.extension_months' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="errorTip('extension_months')">
                  <nz-input-number id="lease-extension" formControlName="extension_months" [nzMin]="1" [nzMax]="maxTermMonths" [nzPrecision]="0" />
                </nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-label>{{ 'LEASES.FIELD.purchase_option_reasonably_certain' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-switch formControlName="purchase_option_reasonably_certain" [attr.aria-label]="'LEASES.FIELD.purchase_option_reasonably_certain' | translate" />
              </nz-form-control>
            </nz-form-item>
            @if (form.controls.purchase_option_reasonably_certain.value) {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="lease-option-price">{{ 'LEASES.FIELD.purchase_option_price' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="errorTip('purchase_option_price')">
                  <input nz-input id="lease-option-price" formControlName="purchase_option_price" inputmode="decimal" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="lease-useful-life">{{ 'LEASES.FIELD.useful_life_months' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="errorTip('useful_life_months')">
                  <nz-input-number id="lease-useful-life" formControlName="useful_life_months" [nzMin]="1" [nzMax]="1200" [nzPrecision]="0" />
                </nz-form-control>
              </nz-form-item>
            }
          </div>

          <h4>{{ 'LEASES.SECTION_EXEMPTION' | translate }}</h4>
          <div class="grid">
            <nz-form-item>
              <nz-form-label>{{ 'LEASES.FIELD.exemption' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('exemption')">
                <nz-select formControlName="exemption">
                  @for (value of exemptions; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'LEASES.EXEMPTION_' + value | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            @if (form.controls.exemption.value === 'low_value') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="lease-asset-value">{{ 'LEASES.FIELD.underlying_asset_value' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="errorTip('underlying_asset_value')">
                  <input nz-input id="lease-asset-value" formControlName="underlying_asset_value" inputmode="decimal" />
                </nz-form-control>
              </nz-form-item>
            }
            <nz-form-item class="span-2">
              <nz-form-label nzFor="lease-notes">{{ 'LEASES.FIELD.notes' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('notes')">
                <textarea nz-input id="lease-notes" formControlName="notes" rows="2" maxlength="4000"></textarea>
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 16px;
    }
    .span-2 {
      grid-column: span 2;
    }
    h4 {
      margin: 8px 0;
    }
  `,
})
export class LeaseFormComponent {
  private readonly api = inject(LeaseAccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly visible = model(false);
  /** The draft to change, or `null` to create a lease. */
  readonly lease = input<LeaseContract | null>(null);
  readonly saved = output<LeaseContract>();

  protected readonly assetClasses = LEASE_ASSET_CLASSES;
  protected readonly standards = LEASE_STANDARDS;
  protected readonly currencies = LEASE_CURRENCIES;
  protected readonly frequencies = LEASE_PAYMENT_FREQUENCIES;
  protected readonly timings = LEASE_PAYMENT_TIMINGS;
  protected readonly escalationTypes = LEASE_ESCALATION_TYPES;
  protected readonly exemptions = LEASE_EXEMPTIONS;
  protected readonly maxTermMonths = MAX_TERM_MONTHS;
  protected readonly saving = signal(false);

  protected readonly form = this.buildForm();

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.reset(this.lease());
      }
    });

    const form = this.form;
    const revalidate = (source: AbstractControl, ...targets: AbstractControl[]): void => {
      source.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => targets.forEach((target) => target.updateValueAndValidity({ emitEvent: false })));
    };

    revalidate(form.controls.payment_frequency, form.controls.term_months);
    revalidate(form.controls.extension_months, form.controls.term_months);
    revalidate(form.controls.extension_reasonably_certain, form.controls.term_months, form.controls.extension_months);
    revalidate(form.controls.purchase_option_reasonably_certain, form.controls.purchase_option_price, form.controls.useful_life_months);
    revalidate(form.controls.exemption, form.controls.underlying_asset_value);
  }

  buildForm() {
    return this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(190)]],
      lessor_name: ['', [Validators.required, Validators.maxLength(190)]],
      asset_class: ['real_estate' as LeaseContractRequest['asset_class'], [Validators.required]],
      asset_description: ['', [Validators.maxLength(2000)]],
      accounting_standard: ['ifrs16' as NonNullable<LeaseContractRequest['accounting_standard']>],
      currency: ['EUR' as LeaseContractRequest['currency'], [Validators.required]],
      commencement_date: ['', [Validators.required]],
      term_months: [12 as number | null, [Validators.required, Validators.min(1), Validators.max(MAX_TERM_MONTHS), termMultipleOfFrequency]],
      payment_amount: ['', [Validators.required, Validators.pattern(AMOUNT_PATTERN)]],
      payment_frequency: ['monthly' as NonNullable<LeaseContractRequest['payment_frequency']>],
      payment_timing: ['arrears' as NonNullable<LeaseContractRequest['payment_timing']>],
      escalation_type: ['none' as NonNullable<LeaseContractRequest['escalation_type']>],
      escalation_rate_percent: ['', [Validators.pattern(RATE_PATTERN)]],
      incremental_borrowing_rate_percent: ['', [Validators.required, Validators.pattern(RATE_PATTERN)]],
      initial_direct_costs: ['0.00', [amountOrEmpty]],
      incentives_received: ['0.00', [amountOrEmpty]],
      purchase_option_reasonably_certain: [false],
      purchase_option_price: ['', [requiredWhen((v) => v['purchase_option_reasonably_certain'] === true), amountOrEmpty]],
      useful_life_months: [null as number | null, [requiredWhen((v) => v['purchase_option_reasonably_certain'] === true), Validators.min(1), Validators.max(1200)]],
      extension_reasonably_certain: [false],
      extension_months: [null as number | null, [requiredWhen((v) => v['extension_reasonably_certain'] === true), Validators.min(1), Validators.max(MAX_TERM_MONTHS)]],
      exemption: ['none' as NonNullable<LeaseContractRequest['exemption']>],
      underlying_asset_value: ['', [requiredWhen((v) => v['exemption'] === 'low_value'), amountOrEmpty]],
      notes: ['', [Validators.maxLength(4000)]],
    });
  }

  protected errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(this.form as unknown as FormGroup, path) ?? '';
    }
    if (control?.hasError('termMultiple')) {
      return this.i18n.translate('LEASES.ERR_TERM_MULTIPLE');
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.payload(this.form.getRawValue());
    const current = this.lease();
    this.saving.set(true);
    const request = current ? this.api.updateContract(current.id, payload) : this.api.createContract(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate(current ? 'LEASES.MSG_UPDATED' : 'LEASES.MSG_CREATED'));
        this.visible.set(false);
        this.saved.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form as unknown as FormGroup, err);
        this.message.error(unmapped[0] ?? this.i18n.translate('LEASES.MSG_ERROR'));
      },
    });
  }

  private reset(lease: LeaseContract | null): void {
    this.form.reset();
    if (lease === null) {
      this.form.patchValue({ commencement_date: new Date().toISOString().slice(0, 10) });
      return;
    }

    this.form.patchValue({
      title: lease.title,
      lessor_name: lease.lessor_name,
      asset_class: lease.asset_class,
      asset_description: lease.asset_description ?? '',
      accounting_standard: lease.accounting_standard,
      currency: lease.currency,
      commencement_date: lease.commencement_date,
      term_months: lease.term_months,
      payment_amount: lease.payment_amount,
      payment_frequency: lease.payment_frequency,
      payment_timing: lease.payment_timing,
      escalation_type: lease.escalation_type,
      escalation_rate_percent: lease.escalation_type === 'fixed' ? lease.escalation_rate_percent : '',
      incremental_borrowing_rate_percent: lease.incremental_borrowing_rate_percent,
      initial_direct_costs: lease.initial_direct_costs,
      incentives_received: lease.incentives_received,
      purchase_option_reasonably_certain: lease.purchase_option_reasonably_certain,
      purchase_option_price: lease.purchase_option_price ?? '',
      useful_life_months: lease.useful_life_months ?? null,
      extension_reasonably_certain: lease.extension_reasonably_certain,
      extension_months: lease.extension_months ?? null,
      exemption: lease.exemption,
      underlying_asset_value: lease.underlying_asset_value ?? '',
      notes: lease.notes ?? '',
    });
  }

  private payload(value: LeaseFormValues): LeaseContractRequest {
    const text = (input: string | null | undefined): string | null => (input === null || input === undefined || input === '' ? null : input);

    return {
      title: value.title ?? '',
      lessor_name: value.lessor_name ?? '',
      asset_class: value.asset_class ?? 'real_estate',
      asset_description: text(value.asset_description),
      accounting_standard: value.accounting_standard,
      currency: value.currency ?? 'EUR',
      commencement_date: value.commencement_date ?? '',
      term_months: Number(value.term_months),
      payment_amount: value.payment_amount ?? '',
      payment_frequency: value.payment_frequency,
      payment_timing: value.payment_timing,
      escalation_type: value.escalation_type,
      escalation_rate_percent: value.escalation_type === 'fixed' ? text(value.escalation_rate_percent) : null,
      incremental_borrowing_rate_percent: value.incremental_borrowing_rate_percent ?? '',
      initial_direct_costs: value.initial_direct_costs || '0',
      incentives_received: value.incentives_received || '0',
      purchase_option_reasonably_certain: value.purchase_option_reasonably_certain,
      purchase_option_price: value.purchase_option_reasonably_certain ? text(value.purchase_option_price) : null,
      useful_life_months: value.purchase_option_reasonably_certain ? (value.useful_life_months ?? null) : null,
      extension_reasonably_certain: value.extension_reasonably_certain,
      extension_months: value.extension_reasonably_certain ? (value.extension_months ?? null) : null,
      exemption: value.exemption,
      underlying_asset_value: value.exemption === 'low_value' ? text(value.underlying_asset_value) : null,
      notes: text(value.notes),
    };
  }
}
