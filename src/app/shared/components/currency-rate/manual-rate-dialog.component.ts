import { Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CurrencyApiService } from '@core/api/currency-api.service';
import { applyServerErrors } from '@core/http/laravel-http.utils';
import { I18nService } from '@core/i18n/i18n.service';
import {
  CurrencyRate,
  CurrencyRatePayload,
  CurrencyRateType,
  MANUAL_RATE_TYPES,
} from '@core/models/currency-fx.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { toIsoDate } from '../../utils/iso-date';
import { normalizeRate, rateValidator } from './currency-rate.util';

/**
 * Dialog to enter an exchange rate by hand (manual override or contract rate). The rate stays a decimal string with at
 * most six decimals; a contract rate needs a reason (audit). 422 answers are mapped to the fields.
 */
@Component({
  selector: 'app-manual-rate-dialog',
  styles: `
    .fx-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0 16px;
    }
  `,
  imports: [
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'FINANCE.CURRENCIES.MANUAL_RATE.TITLE' | translate"
      [nzFooter]="footer"
      [nzWidth]="560"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        <form
          nz-form
          nzLayout="vertical"
          [formGroup]="form"
          (ngSubmit)="submit()"
          id="manual-rate-form"
        >
          <div class="fx-grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mr-base">{{
                'FINANCE.CURRENCIES.FIELD.BASE' | translate
              }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('base')">
                <input
                  nz-input
                  id="mr-base"
                  formControlName="base"
                  maxlength="3"
                  autocomplete="off"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mr-quote">{{
                'FINANCE.CURRENCIES.FIELD.QUOTE' | translate
              }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('quote')">
                <input
                  nz-input
                  id="mr-quote"
                  formControlName="quote"
                  maxlength="3"
                  autocomplete="off"
                />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="fx-grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mr-rate">{{
                'FINANCE.CURRENCIES.FIELD.RATE' | translate
              }}</nz-form-label>
              <nz-form-control
                [nzErrorTip]="errorTip('rate')"
                [nzExtra]="'FINANCE.CURRENCIES.HINT.RATE_PRECISION' | translate"
              >
                <input
                  nz-input
                  id="mr-rate"
                  formControlName="rate"
                  inputmode="decimal"
                  autocomplete="off"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mr-valid-on">{{
                'FINANCE.CURRENCIES.FIELD.VALID_ON' | translate
              }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('valid_on')">
                <input nz-input id="mr-valid-on" type="date" formControlName="valid_on" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="mr-type">{{
              'FINANCE.CURRENCIES.FIELD.RATE_TYPE' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('rate_type')">
              <nz-select nzId="mr-type" formControlName="rate_type">
                @for (type of rateTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'FINANCE.CURRENCIES.RATE_TYPE.' + type | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label [nzRequired]="reasonRequired()" nzFor="mr-reason">{{
              'FINANCE.CURRENCIES.FIELD.REASON' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('reason')">
              <textarea
                nz-input
                id="mr-reason"
                formControlName="reason"
                rows="2"
                maxlength="500"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="mr-contract">{{
              'FINANCE.CURRENCIES.FIELD.CONTRACT_REFERENCE' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('contract_reference')">
              <input
                nz-input
                id="mr-contract"
                formControlName="contract_reference"
                maxlength="100"
                autocomplete="off"
              />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" (click)="close()">
          {{ 'FINANCE.CURRENCIES.ACTION.CANCEL' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="submit"
          form="manual-rate-form"
          [nzLoading]="saving()"
          [disabled]="saving()"
        >
          {{ 'FINANCE.CURRENCIES.ACTION.SAVE_RATE' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class ManualRateDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CurrencyApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  /** Pre-filled currency pair and date (for example the pair and the date of the document that has no rate). */
  readonly base = input('');
  readonly quote = input('');
  readonly validOn = input<string | null>(null);
  readonly rateType = input<CurrencyRateType>('mid');
  readonly saved = output<CurrencyRate>();

  protected readonly rateTypes = MANUAL_RATE_TYPES;
  readonly saving = signal(false);
  protected readonly reasonRequired = signal(false);

  readonly form = this.fb.group({
    base: this.fb.control('', [Validators.required, Validators.pattern(/^[A-Z]{3}$/u)]),
    quote: this.fb.control('', [Validators.required, Validators.pattern(/^[A-Z]{3}$/u)]),
    rate: this.fb.control('', [Validators.required, rateValidator]),
    valid_on: this.fb.control('', Validators.required),
    rate_type: this.fb.control<CurrencyRateType>('mid', Validators.required),
    reason: this.fb.control('', Validators.maxLength(500)),
    contract_reference: this.fb.control('', Validators.maxLength(100)),
  });

  constructor() {
    this.form.controls.rate_type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((type) => this.applyReasonRule(type));
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  close(): void {
    this.open.set(false);
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('required')) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.REQUIRED');
    }
    if (control?.hasError('rateFormat')) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.RATE_FORMAT');
    }
    if (control?.hasError('ratePositive')) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.RATE_POSITIVE');
    }
    if (control?.hasError('pattern')) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.CURRENCY_CODE');
    }
    const server = control?.errors?.['serverError'];
    return typeof server === 'string' ? server : '';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const reason = value.reason.trim();
    const contractReference = value.contract_reference.trim();
    const payload: CurrencyRatePayload = {
      base: value.base,
      quote: value.quote,
      rate: normalizeRate(value.rate),
      valid_on: value.valid_on,
      rate_type: value.rate_type,
      reason: reason === '' ? null : reason,
      contract_reference: contractReference === '' ? null : contractReference,
    };
    this.saving.set(true);
    this.api.createRate(payload).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('FINANCE.CURRENCIES.MESSAGE.RATE_SAVED'));
        this.saved.emit(response.data);
        this.close();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, error).forEach((text) => this.message.error(text));
      },
    });
  }

  /** `reason` is mandatory for a contract rate (the API refuses it otherwise). */
  private applyReasonRule(type: CurrencyRateType): void {
    const reason = this.form.controls.reason;
    const required = type === 'contract';
    this.reasonRequired.set(required);
    reason.setValidators(
      required ? [Validators.required, Validators.maxLength(500)] : [Validators.maxLength(500)],
    );
    reason.updateValueAndValidity();
  }

  private reset(): void {
    const type = this.rateType();
    this.form.reset({
      base: this.base().toUpperCase(),
      quote: this.quote().toUpperCase(),
      rate: '',
      valid_on: this.validOn() ?? toIsoDate(new Date()),
      rate_type: type,
      reason: '',
      contract_reference: '',
    });
    this.applyReasonRule(type);
  }
}
