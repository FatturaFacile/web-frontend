import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  applyServerErrors,
  I18nService,
  isValidationError,
  ShortTimeApiService,
  ShortTimeClaim,
  ShortTimeClaimEmployeePayload,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CrudOption } from '../shared/crud/crud.types';
import { decimalStringValidator } from '../shared/hr-decimal.validator';
import { reportHttpError } from '../shared/hr-http.util';

const HOUR_FIELDS = [
  'target_hours',
  'worked_hours',
  'absence_hours',
  'overtime_hours',
  'regular_allowances',
] as const;

/** Calculates the monthly claim of a case: hours left empty come from the working time records (server side). */
@Component({
  selector: 'app-short-time-claim-modal',
  imports: [
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
      [nzOkText]="'hrmShortTime.claim.calculate' | translate"
      [nzCancelText]="'hrmCommon.cancel' | translate"
      [nzOkLoading]="saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'hrmShortTime.claim.hint' | translate }}</p>
        <form [formGroup]="form">
          <div class="flex gap-3 mb-3">
            <div>
              <label for="claim-year">{{ 'hrmCommon.year' | translate }}</label>
              <input nz-input id="claim-year" inputmode="numeric" formControlName="year" />
            </div>
            <div>
              <label for="claim-month">{{ 'hrmLeave.month' | translate }}</label>
              <input nz-input id="claim-month" inputmode="numeric" formControlName="month" />
            </div>
          </div>
          <div formArrayName="employees">
            @for (row of rows.controls; track row; let i = $index) {
              <div [formGroupName]="i" class="flex gap-2 items-end mb-2 flex-wrap">
                <div style="width: 220px">
                  <label [attr.for]="'claim-emp-' + i">{{
                    'hrmCommon.employee' | translate
                  }}</label>
                  <nz-select
                    [id]="'claim-emp-' + i"
                    formControlName="employee_id"
                    nzShowSearch
                    style="width: 100%"
                  >
                    @for (option of employees(); track option.value) {
                      <nz-option
                        [nzValue]="option.value"
                        [nzLabel]="option.label ?? option.value"
                      />
                    }
                  </nz-select>
                </div>
                @for (field of hourFields; track field) {
                  <div style="width: 110px">
                    <label [attr.for]="'claim-' + field + i">{{
                      'hrmShortTime.claim.' + field | translate
                    }}</label>
                    <input
                      nz-input
                      inputmode="decimal"
                      [id]="'claim-' + field + i"
                      [formControlName]="field"
                    />
                  </div>
                }
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label nz-checkbox formControlName="consented">{{
                  'hrmShortTime.claim.consented' | translate
                }}</label>
                <button nz-button nzDanger nzSize="small" type="button" (click)="removeRow(i)">
                  {{ 'hrmCommon.delete' | translate }}
                </button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addRow()">
            {{ 'hrmShortTime.claim.addEmployee' | translate }}
          </button>
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
      validators: [Validators.required, Validators.pattern(/^\d{4}$/)],
    }),
    month: new FormControl(String(new Date().getMonth() + 1), {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(1[0-2]|[1-9])$/)],
    }),
    employees: new FormArray<FormGroup>([]),
  });

  protected get rows(): FormArray<FormGroup> {
    return this.form.controls.employees;
  }

  protected addRow(): void {
    this.rows.push(
      new FormGroup({
        employee_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        target_hours: new FormControl('', {
          nonNullable: true,
          validators: [decimalStringValidator],
        }),
        worked_hours: new FormControl('', {
          nonNullable: true,
          validators: [decimalStringValidator],
        }),
        absence_hours: new FormControl('', {
          nonNullable: true,
          validators: [decimalStringValidator],
        }),
        overtime_hours: new FormControl('', {
          nonNullable: true,
          validators: [decimalStringValidator],
        }),
        regular_allowances: new FormControl('', {
          nonNullable: true,
          validators: [decimalStringValidator],
        }),
        consented: new FormControl(true, { nonNullable: true }),
      }),
    );
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
