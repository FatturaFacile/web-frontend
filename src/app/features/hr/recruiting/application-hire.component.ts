import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { applyServerErrors, HrTalentApiService, I18nService, isValidationError } from '@core';
import { TranslatePipe } from '@shared';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { decimalStringValidator } from '../shared/hr-decimal.validator';
import { reportHttpError } from '../shared/hr-http.util';

/** Weekly hours mirror the API rule between:1,60 (empty is allowed). */
function weeklyHoursRangeValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (raw === '' || Number.isNaN(Number(raw))) {
    return null;
  }
  const hours = Number(raw);
  return hours >= 1 && hours <= 60 ? null : { range: true };
}

/** Hires a candidate: creates the employee (and the onboarding checklist when a template is given). */
@Component({
  selector: 'app-application-hire',
  styleUrl: './application-hire.component.scss',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="applicationId() !== null"
      [nzTitle]="'hrmRecruiting.hire' | translate"
      [nzOkText]="'hrmCommon.confirm' | translate"
      [nzCancelText]="'hrmCommon.cancel' | translate"
      [nzOkLoading]="saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="hire-salary">{{ 'hrmEmp.baseAnnualSalary' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('base_annual_salary')">
              <input nz-input id="hire-salary" inputmode="decimal" formControlName="base_annual_salary" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="hire-date">{{ 'hrmSelfService.hireDate' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('hire_date')">
              <input nz-input id="hire-date" type="date" formControlName="hire_date" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="hire-email">{{ 'hrmSelfService.workEmail' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('work_email')">
              <input nz-input id="hire-email" type="email" formControlName="work_email" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="hire-hours">{{ 'hrmEmp.weeklyHours' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('weekly_hours')">
              <input nz-input id="hire-hours" inputmode="decimal" formControlName="weekly_hours" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ApplicationHireComponent {
  /** Application to hire; null keeps the modal closed. */
  readonly applicationId = input<string | null>(null);
  readonly closed = output<void>();
  readonly hired = output<void>();

  private readonly api = inject(HrTalentApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    base_annual_salary: ['', [Validators.required, decimalStringValidator]],
    hire_date: ['', Validators.required],
    work_email: ['', [Validators.email, Validators.maxLength(180)]],
    weekly_hours: ['', [decimalStringValidator, weeklyHoursRangeValidator]],
  });

  protected errorTip(key: string): string {
    const errors = this.form.get(key)?.errors;
    if (errors?.['serverError']) {
      return String(errors['serverError']);
    }
    if (errors?.['required']) {
      return this.i18n.translate('hrmCommon.required');
    }
    if (errors?.['email']) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_EMAIL');
    }
    if (errors?.['decimal']) {
      return this.i18n.translate('hrmCommon.invalidDecimal');
    }
    return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
  }

  protected submit(): void {
    const id = this.applicationId();
    if (!id || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .hireCandidate(id, {
        base_annual_salary: value.base_annual_salary.trim(),
        hire_date: value.hire_date,
        work_email: value.work_email || null,
        weekly_hours: value.weekly_hours.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success(this.i18n.translate('hrmRecruiting.hired'));
          this.hired.emit();
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
