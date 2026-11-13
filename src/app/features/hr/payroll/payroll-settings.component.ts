import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { applyServerErrors, I18nService, isValidationError, PayrollApiService, PayrollSettingsPayload } from '@core';
import { IconActionDirective } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { decimalStringValidator } from '../shared/hr-decimal.validator';
import { reportHttpError } from '../shared/hr-http.util';

interface SettingsField {
  key: string;
  type: 'decimal' | 'text';
}

const DECIMAL = (key: string): SettingsField => ({ key, type: 'decimal' });
const TEXT = (key: string): SettingsField => ({ key, type: 'text' });

/** Field lists mirror the request bodies. The values come from (and go back to) the server: nothing is hard-coded. */
const FIELDS: Record<'swiss' | 'italian', SettingsField[]> = {
  swiss: [
    DECIMAL('ahv_employee_rate_percent'),
    DECIMAL('ahv_employer_rate_percent'),
    DECIMAL('ahv_administration_cost_percent'),
    DECIMAL('alv_employee_rate_percent'),
    DECIMAL('alv_employer_rate_percent'),
    DECIMAL('alv_annual_ceiling'),
    DECIMAL('uvg_annual_ceiling'),
    DECIMAL('nbu_employee_rate_percent'),
    DECIMAL('bu_employer_rate_percent'),
    DECIMAL('ktg_employee_rate_percent'),
    DECIMAL('ktg_employer_rate_percent'),
    DECIMAL('fak_employer_rate_percent'),
    DECIMAL('bvg_employer_share_percent'),
    DECIMAL('bvg_risk_rate_percent'),
    DECIMAL('pensioner_allowance_monthly'),
    TEXT('default_work_canton'),
    TEXT('ahv_member_number'),
    TEXT('uvg_insurer'),
    TEXT('bvg_insurer'),
  ],
  italian: [
    TEXT('inps_company_number'),
    TEXT('inps_office_code'),
    TEXT('inail_code'),
    DECIMAL('employee_inps_rate_percent'),
    DECIMAL('employer_inps_rate_percent'),
  ],
};

/** Payroll settings of a country (Swiss or INPS/INAIL): load, edit, save. Decimal fields stay strings. */
@Component({
  selector: 'app-payroll-settings',
  styleUrl: './payroll-settings.component.scss',
  imports: [IconActionDirective, ReactiveFormsModule, NzButtonModule, NzFormModule, NzInputModule, NzSkeletonModule],
  template: `
    @if (loading()) {
      <nz-skeleton [nzActive]="true" />
    } @else {
      <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="save()" class="settings-grid">
        @for (field of fields(); track field.key) {
          <nz-form-item>
            <nz-form-label [nzFor]="'ps-' + field.key">{{ label(field.key) }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(field.key)">
              <input
                nz-input
                [id]="'ps-' + field.key"
                [attr.inputmode]="field.type === 'decimal' ? 'decimal' : null"
                [formControlName]="field.key"
              />
            </nz-form-control>
          </nz-form-item>
        }
        @if (canWrite()) {
          <button nz-button nzType="primary" type="submit" [nzLoading]="saving()" [disabled]="form.invalid" appIconAction="save"></button>
        }
      </form>
    }
  `,
})
export class PayrollSettingsComponent implements OnInit {
  readonly country = input.required<'swiss' | 'italian'>();
  readonly canWrite = input(false);

  private readonly api = inject(PayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly fields = computed(() => FIELDS[this.country()]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected form = new FormGroup<Record<string, FormControl<string>>>({});

  ngOnInit(): void {
    const controls: Record<string, FormControl<string>> = {};
    for (const field of this.fields()) {
      const validators: ValidatorFn[] = field.type === 'decimal' ? [decimalStringValidator] : [];
      controls[field.key] = new FormControl('', { nonNullable: true, validators });
    }
    this.form = new FormGroup(controls);
    this.api.getSettings(this.country()).subscribe({
      next: (res) => {
        const values: Record<string, string> = {};
        for (const field of this.fields()) {
          values[field.key] = String(res.data[field.key] ?? '');
        }
        this.form.patchValue(values);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected label(key: string): string {
    const path = `hrmPayroll.settingsField.${key}`;
    const text = this.i18n.translate(path);
    return text === path ? key : text;
  }

  protected errorTip(key: string): string {
    const errors = this.form.get(key)?.errors;
    if (errors?.['serverError']) {
      return String(errors['serverError']);
    }
    return this.i18n.translate('hrmCommon.invalidDecimal');
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: PayrollSettingsPayload = {};
    for (const field of this.fields()) {
      const value = this.form.controls[field.key].value.trim();
      if (value !== '') {
        payload[field.key] = value;
      }
    }
    this.saving.set(true);
    this.api.saveSettings(this.country(), payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('hrmCommon.saved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.form, err);
        } else {
          reportHttpError(err, this.message, this.i18n);
        }
      },
    });
  }
}
