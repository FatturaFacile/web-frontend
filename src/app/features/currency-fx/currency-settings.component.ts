import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  applyServerErrors,
  CurrencyApiService,
  CurrencySettings,
  I18nService,
  UNREALIZED_GAIN_TREATMENTS,
  UnrealizedGainTreatment,
  VAT_RATE_METHODS,
  VatRateMethod,
} from '@core';
import { currencyProblemText, isCurrencyFailure, TranslatePipe } from '@shared';
import { KNOWN_CURRENCIES } from './currency-fx.util';

/** Percentage with at most two decimals between 0 and 100 (the threshold of the rate-change alert). */
const PERCENT_PATTERN = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/u;

/**
 * Currency settings of the tenant: active currencies, alert threshold, treatment of unrealised gains and the VAT rate
 * method. Deactivating a currency that still has open items is refused by the API (409): its message is shown here.
 */
@Component({
  selector: 'app-currency-settings',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  styleUrl: './currency-fx.scss',
  template: `
    <nz-spin [nzSpinning]="loading()">
      @if (conflict(); as text) {
        <nz-alert
          class="form-alert settings-conflict"
          nzType="error"
          nzShowIcon
          nzCloseable
          [nzMessage]="text"
          (nzOnClose)="conflict.set(null)"
        ></nz-alert>
      }
      @if (loadFailed()) {
        <nz-alert
          class="form-alert"
          nzType="error"
          nzShowIcon
          [nzMessage]="'FINANCE.CURRENCIES.ERROR.LOAD_FAILED' | translate"
        ></nz-alert>
      }
      <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="save()">
        <p class="muted">
          {{ 'FINANCE.CURRENCIES.SETTINGS.FUNCTIONAL_CURRENCY' | translate }}:
          <strong>{{ functional() }}</strong>
        </p>
        <div class="grid">
          <nz-form-item>
            <nz-form-label nzFor="cs-active">{{
              'FINANCE.CURRENCIES.SETTINGS.ACTIVE_CURRENCIES' | translate
            }}</nz-form-label>
            <nz-form-control
              [nzErrorTip]="errorTip('active_currencies')"
              [nzExtra]="'FINANCE.CURRENCIES.HINT.ACTIVE_CURRENCIES' | translate"
            >
              <nz-select
                nzId="cs-active"
                nzMode="multiple"
                formControlName="active_currencies"
                [nzOptions]="currencyOptions()"
              ></nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="cs-threshold">{{
              'FINANCE.CURRENCIES.SETTINGS.ALERT_THRESHOLD' | translate
            }}</nz-form-label>
            <nz-form-control
              [nzErrorTip]="errorTip('alert_threshold_percent')"
              [nzExtra]="'FINANCE.CURRENCIES.HINT.ALERT_THRESHOLD' | translate"
            >
              <input
                nz-input
                id="cs-threshold"
                formControlName="alert_threshold_percent"
                inputmode="decimal"
                autocomplete="off"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="cs-treatment">{{
              'FINANCE.CURRENCIES.SETTINGS.UNREALIZED_TREATMENT' | translate
            }}</nz-form-label>
            <nz-form-control
              [nzErrorTip]="errorTip('unrealized_gain_treatment')"
              [nzExtra]="'FINANCE.CURRENCIES.HINT.UNREALIZED_TREATMENT' | translate"
            >
              <nz-select nzId="cs-treatment" formControlName="unrealized_gain_treatment">
                @for (treatment of treatments; track treatment) {
                  <nz-option
                    [nzValue]="treatment"
                    [nzLabel]="'FINANCE.CURRENCIES.TREATMENT.' + treatment | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="cs-vat">{{
              'FINANCE.CURRENCIES.SETTINGS.VAT_RATE_METHOD' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('vat_rate_method')">
              <nz-select nzId="cs-vat" formControlName="vat_rate_method">
                @for (method of vatMethods; track method) {
                  <nz-option
                    [nzValue]="method"
                    [nzLabel]="'FINANCE.CURRENCIES.VAT_METHOD.' + method | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </div>
        @if (canWrite()) {
          <div class="form-footer">
            <button nz-button nzType="primary" type="submit" [nzLoading]="saving()">
              {{ 'FINANCE.CURRENCIES.ACTION.SAVE_SETTINGS' | translate }}
            </button>
          </div>
        }
      </form>
    </nz-spin>
  `,
})
export class CurrencySettingsComponent implements OnInit {
  private readonly api = inject(CurrencyApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly canWrite = input(true);

  protected readonly treatments = UNREALIZED_GAIN_TREATMENTS;
  protected readonly vatMethods = VAT_RATE_METHODS;

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadFailed = signal(false);
  /** Message of the 409 (a currency to deactivate still has open items). */
  readonly conflict = signal<string | null>(null);
  private readonly settings = signal<CurrencySettings | null>(null);

  protected readonly functional = computed(() => this.settings()?.functional_currency ?? '');
  protected readonly currencyOptions = computed(() => {
    const codes = new Set([...KNOWN_CURRENCIES, ...(this.settings()?.active_currencies ?? [])]);
    return Array.from(codes).map((code) => ({ label: code, value: code }));
  });

  readonly form = this.fb.group({
    active_currencies: this.fb.control<string[]>([], Validators.required),
    alert_threshold_percent: this.fb.control('2.50', [
      Validators.required,
      Validators.pattern(PERCENT_PATTERN),
    ]),
    unrealized_gain_treatment: this.fb.control<UnrealizedGainTreatment>(
      'recognise',
      Validators.required,
    ),
    vat_rate_method: this.fb.control<VatRateMethod>('estv_monthly', Validators.required),
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const response = await firstValueFrom(this.api.getSettings());
      this.settings.set(response.data);
      this.form.reset({
        active_currencies: response.data.active_currencies,
        alert_threshold_percent: response.data.alert_threshold_percent,
        unrealized_gain_treatment: response.data.unrealized_gain_treatment,
        vat_rate_method: response.data.vat_rate_method,
      });
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('required')) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.REQUIRED');
    }
    if (control?.hasError('pattern')) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.PERCENT_FORMAT');
    }
    const server = control?.errors?.['serverError'];
    return typeof server === 'string' ? server : '';
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.conflict.set(null);
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    try {
      const response = await firstValueFrom(
        this.api.updateSettings({
          ...value,
          alert_threshold_percent: value.alert_threshold_percent.trim(),
        }),
      );
      this.settings.set(response.data);
      this.message.success(this.i18n.translate('FINANCE.CURRENCIES.MESSAGE.SETTINGS_SAVED'));
    } catch (error) {
      if (isCurrencyFailure(error, 409)) {
        // The server says which currency still has open items: show its message as it is.
        this.conflict.set(
          currencyProblemText(error) ??
            this.i18n.translate('FINANCE.CURRENCIES.ERROR.SETTINGS_CONFLICT'),
        );
      } else {
        applyServerErrors(this.form, error).forEach((text) => this.message.error(text));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
