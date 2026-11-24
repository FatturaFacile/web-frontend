import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { startWith } from 'rxjs';
import {
  applyServerErrors,
  FISCAL_REGIMES,
  FiscalPreferences,
  FORFETTARIO_REGIME,
  FUND_TYPES,
  I18nService,
  isValidationError,
  NATURA_CODES,
  serverErrorMessage,
  SettingsApiService,
  StampDutyChargeMode,
  WITHHOLDING_REASONS,
  WITHHOLDING_TYPES,
} from '@core';
import { TranslatePipe, RadioControlDirective } from '@shared';

const toNumber = (v: unknown, fallback: number | null): number | null =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v);

/**
 * "Fiscal" tab of Settings (issue #286): regime, default cassa and ritenuta, stamp duty payer and ENASARCO,
 * saved as the `fiscal` preference group. Rates are user input; legal wording is added by the backend.
 */
@Component({
  selector: 'app-fiscal-settings',
  imports: [
    RadioControlDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    TranslatePipe,
  ],
  templateUrl: './fiscal-settings.component.html',
  styleUrl: './fiscal-settings.component.scss',
})
export class FiscalSettingsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly regimes = FISCAL_REGIMES;
  protected readonly fundTypes = FUND_TYPES;
  protected readonly withholdingTypes = WITHHOLDING_TYPES;
  protected readonly reasons = WITHHOLDING_REASONS;
  protected readonly naturaCodes = NATURA_CODES;

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  /** The saved settings could not be read: saving would overwrite them with the form defaults. */
  protected readonly loadFailed = signal(false);

  readonly form = this.fb.group({
    regime_fiscale: this.fb.control('RF01', Validators.required),
    default_fund_enabled: this.fb.control(false),
    default_fund: this.fb.group({
      type: this.fb.control('TC22', Validators.required),
      percent: this.fb.control(0, [Validators.required, Validators.min(0), Validators.max(100)]),
      vat_rate: new FormControl<number | null>(null, [Validators.min(0), Validators.max(100)]),
      natura: new FormControl<string | null>(null),
      withholding_applies: this.fb.control(false),
    }),
    default_withholding_enabled: this.fb.control(false),
    default_withholding: this.fb.group({
      type: this.fb.control('RT01', Validators.required),
      reason: this.fb.control('A', Validators.required),
      rate: this.fb.control(0, [Validators.required, Validators.min(0), Validators.max(100)]),
      taxable_percent: new FormControl<number | null>(100, [
        Validators.min(0),
        Validators.max(100),
      ]),
      includes_fund: this.fb.control(false),
    }),
    stamp_duty_charge_mode: this.fb.control<StampDutyChargeMode>('customer'),
    enasarco_enabled: this.fb.control(false),
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly forfettario = computed(
    () => this.value().regime_fiscale === FORFETTARIO_REGIME,
  );
  protected readonly fundEnabled = computed(() => !!this.value().default_fund_enabled);
  protected readonly withholdingEnabled = computed(
    () => !!this.value().default_withholding_enabled && !this.forfettario(),
  );

  constructor() {
    // A forfettario tenant never applies ritenuta: the default is switched off and locked.
    this.form.controls.regime_fiscale.valueChanges.pipe(startWith(null)).subscribe(() => {
      const toggle = this.form.controls.default_withholding_enabled;
      if (this.form.controls.regime_fiscale.value === FORFETTARIO_REGIME) {
        toggle.setValue(false);
        toggle.disable();
      } else {
        toggle.enable();
      }
    });
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getTenantPreferences().subscribe({
      next: (res) => {
        const fiscal = res.data?.fiscal;
        if (fiscal && !Array.isArray(fiscal)) {
          this.patch(fiscal);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  private patch(p: FiscalPreferences): void {
    const fund = p.default_fund;
    const wh = p.default_withholding;
    this.form.patchValue({
      regime_fiscale: p.regime_fiscale ?? 'RF01',
      default_fund_enabled: !!fund,
      default_withholding_enabled: !!wh,
      stamp_duty_charge_mode: p.stamp_duty_charge_mode ?? 'customer',
      enasarco_enabled: !!p.enasarco_enabled,
    });
    if (fund) {
      this.form.controls.default_fund.patchValue({
        type: fund.type,
        percent: toNumber(fund.percent, 0) ?? 0,
        vat_rate: toNumber(fund.vat_rate, null),
        natura: fund.natura ?? null,
        withholding_applies: !!fund.withholding_applies,
      });
    }
    if (wh) {
      this.form.controls.default_withholding.patchValue({
        type: wh.type,
        reason: wh.reason,
        rate: toNumber(wh.rate, 0) ?? 0,
        taxable_percent: toNumber(wh.taxable_percent, null),
        includes_fund: !!wh.includes_fund,
      });
    }
  }

  /** Body of `PUT /settings/preferences/fiscal`; a disabled default is sent as `null` (removed). */
  payload(): FiscalPreferences {
    const v = this.form.getRawValue();
    const forfettario = v.regime_fiscale === FORFETTARIO_REGIME;
    return {
      regime_fiscale: v.regime_fiscale,
      default_fund: v.default_fund_enabled ? { ...v.default_fund } : null,
      default_withholding:
        v.default_withholding_enabled && !forfettario ? { ...v.default_withholding } : null,
      stamp_duty_charge_mode: v.stamp_duty_charge_mode,
      enasarco_enabled: v.enasarco_enabled,
    };
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    if (control?.hasError('min') || control?.hasError('max')) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
    }
    return serverErrorMessage(this.form, path) ?? '';
  }

  save(): void {
    if (this.loadFailed()) {
      return;
    }
    const groups = [
      this.form.controls.regime_fiscale,
      ...(this.fundEnabled() ? [this.form.controls.default_fund] : []),
      ...(this.withholdingEnabled() ? [this.form.controls.default_withholding] : []),
    ];
    groups.forEach((c) => c.markAllAsTouched());
    if (groups.some((c) => c.invalid)) {
      return;
    }
    this.saving.set(true);
    this.api
      .updateTenantPreferences('fiscal', this.payload() as Record<string, unknown>)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success(this.i18n.translate('SETTINGS.FISCAL.SAVED'));
        },
        error: (err: unknown) => {
          this.saving.set(false);
          const messages = isValidationError(err)
            ? applyServerErrors(this.form, err)
            : [this.i18n.translate('ERRORS.GENERIC')];
          messages.forEach((m) => this.message.error(m));
        },
      });
  }
}
