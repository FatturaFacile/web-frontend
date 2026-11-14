import { Component, inject, input, model, output, signal } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  applyServerErrors,
  I18nService,
  isValidationError,
  ShortTimeApiService,
  ShortTimeClaim,
  ShortTimeClaimEmployeePayload,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { fieldErrorTip, fieldValidators } from '../shared/crud/crud-validation';
import { CrudField, CrudOption } from '../shared/crud/crud.types';
import { reportHttpError } from '../shared/hr-http.util';

const HOUR_FIELDS = [
  'target_hours',
  'worked_hours',
  'absence_hours',
  'overtime_hours',
  'regular_allowances',
] as const;

/** Mirrors CalculateShortTimeClaimRequest: period, employee and the hour/allowance bounds. */
const YEAR_FIELD: CrudField = { key: 'year', labelKey: 'hrmCommon.year', type: 'integer', required: true, min: 2000, max: 2100 };
const MONTH_FIELD: CrudField = { key: 'month', labelKey: 'hrmLeave.month', type: 'integer', required: true, min: 1, max: 12 };
const EMPLOYEE_FIELD: CrudField = { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', required: true };
const hourField = (key: string): CrudField => ({
  key,
  labelKey: key,
  type: 'decimal',
  min: 0,
  ...(key === 'regular_allowances' ? {} : { max: 400 }),
});

/** Calculates the monthly claim of a case: hours left empty come from the working time records (server side). */
@Component({
  selector: 'app-short-time-claim-modal',
  styleUrl: './short-time-claim-modal.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'hrmShortTime.claim.calculateTitle' | translate"
      nzWidth="960px"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'hrmShortTime.claim.hint' | translate }}</p>
        <form [formGroup]="form">
          <div class="flex gap-3 mb-3">
            <div>
              <label for="claim-year">{{ 'hrmCommon.year' | translate }}<span class="claim-required" aria-hidden="true">*</span></label>
              <input nz-input id="claim-year" inputmode="numeric" formControlName="year" />
              @if (error(form.controls.year); as message) {
                <div class="claim-error" role="alert">{{ message }}</div>
              }
            </div>
            <div>
              <label for="claim-month">{{ 'hrmLeave.month' | translate }}<span class="claim-required" aria-hidden="true">*</span></label>
              <input nz-input id="claim-month" inputmode="numeric" formControlName="month" />
              @if (error(form.controls.month); as message) {
                <div class="claim-error" role="alert">{{ message }}</div>
              }
            </div>
          </div>
          <div formArrayName="employees">
            @for (row of rows.controls; track row; let i = $index) {
              <div [formGroupName]="i" class="flex gap-2 items-end mb-2 flex-wrap">
                <div class="claim-employee">
                  <label [attr.for]="'claim-emp-' + i">{{
                    'hrmCommon.employee' | translate
                  }}<span class="claim-required" aria-hidden="true">*</span></label>
                  <nz-select
                    [id]="'claim-emp-' + i"
                    formControlName="employee_id"
                    nzShowSearch
                    class="w-full"
                  >
                    @for (option of employees(); track option.value) {
                      <nz-option
                        [nzValue]="option.value"
                        [nzLabel]="option.label ?? option.value"
                      />
                    }
                  </nz-select>
                  @if (error(row.get('employee_id')); as message) {
                    <div class="claim-error" role="alert">{{ message }}</div>
                  }
                </div>
                @for (field of hourFields; track field) {
                  <div class="claim-hours">
                    <label [attr.for]="'claim-' + field + i">{{
                      'hrmShortTime.claim.' + field | translate
                    }}</label>
                    <input
                      nz-input
                      inputmode="decimal"
                      [id]="'claim-' + field + i"
                      [formControlName]="field"
                    />
                    @if (error(row.get(field)); as message) {
                      <div class="claim-error" role="alert">{{ message }}</div>
                    }
                  </div>
                }
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label nz-checkbox formControlName="consented">{{
                  'hrmShortTime.claim.consented' | translate
                }}</label>
                <button
                  nz-button
                  nzDanger
                  nzSize="small"
                  type="button"
                  (click)="removeRow(i)"
                  appIconAction="delete"
                ></button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addRow()" appIconAction="add"></button>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ShortTimeClaimModalComponent {
  readonly open = model(false);
  readonly caseId = input<string | null>(null);
  readonly employees = input<CrudOption[]>([]);
  /** The calculated claim. */
  readonly calculated = output<ShortTimeClaim>();

  private readonly api = inject(ShortTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly hourFields = HOUR_FIELDS;
  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    year: new FormControl(String(new Date().getFullYear()), {
      nonNullable: true,
      validators: fieldValidators(YEAR_FIELD),
    }),
    month: new FormControl(String(new Date().getMonth() + 1), {
      nonNullable: true,
      validators: fieldValidators(MONTH_FIELD),
    }),
    employees: new FormArray<FormGroup>([]),
  });

  protected get rows(): FormArray<FormGroup> {
    return this.form.controls.employees;
  }

  protected addRow(): void {
    this.rows.push(
      new FormGroup({
        employee_id: new FormControl('', { nonNullable: true, validators: fieldValidators(EMPLOYEE_FIELD) }),
        target_hours: new FormControl('', { nonNullable: true, validators: fieldValidators(hourField('target_hours')) }),
        worked_hours: new FormControl('', { nonNullable: true, validators: fieldValidators(hourField('worked_hours')) }),
        absence_hours: new FormControl('', { nonNullable: true, validators: fieldValidators(hourField('absence_hours')) }),
        overtime_hours: new FormControl('', { nonNullable: true, validators: fieldValidators(hourField('overtime_hours')) }),
        regular_allowances: new FormControl('', { nonNullable: true, validators: fieldValidators(hourField('regular_allowances')) }),
        consented: new FormControl(true, { nonNullable: true }),
      }),
    );
  }

  /** Message of an invalid, touched control (null while it is fine or untouched). */
  protected error(control: AbstractControl | null): string | null {
    return control && control.touched && control.invalid ? fieldErrorTip(control, this.i18n) : null;
  }

  protected removeRow(index: number): void {
    this.rows.removeAt(index);
  }

  protected submit(): void {
    const caseId = this.caseId();
    if (!caseId) {
      return;
    }
    if (this.rows.length === 0) {
      this.addRow();
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .calculateClaim(caseId, {
        year: Number(raw.year),
        month: Number(raw.month),
        employees: raw.employees.map((row) => this.toEmployee(row as Record<string, unknown>)),
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.open.set(false);
          this.rows.clear();
          this.message.success(this.i18n.translate('hrmShortTime.claim.calculated'));
          this.calculated.emit(res.data);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          if (isValidationError(err)) {
            applyServerErrors(this.form, err);
          }
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  /** Decimal texts travel as typed (the API validates them as numeric); an empty one is left out. */
  private toEmployee(row: Record<string, unknown>): ShortTimeClaimEmployeePayload {
    const employee: Record<string, unknown> = {
      employee_id: row['employee_id'],
      consented: Boolean(row['consented']),
    };
    for (const field of HOUR_FIELDS) {
      const text = String(row[field] ?? '').trim();
      if (text !== '') {
        employee[field] = text;
      }
    }
    return employee as unknown as ShortTimeClaimEmployeePayload;
  }
}
