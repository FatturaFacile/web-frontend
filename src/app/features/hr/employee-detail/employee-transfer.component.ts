import { Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  applyServerErrors,
  DepartmentResource,
  HrEmployeeApiService,
  I18nService,
  isValidationError,
  PositionResource,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { reportHttpError } from '../shared/hr-http.util';

/** Transfer of an employee to another department / position (lifecycle event). */
@Component({
  selector: 'app-employee-transfer',
  styleUrl: './employee-transfer.component.scss',
  imports: [ReactiveFormsModule, NzButtonModule, NzFormModule, NzInputModule, NzModalModule, NzSelectModule, TranslatePipe],
  template: `
    <button nz-button type="button" (click)="open()">{{ 'hrmEmp.transfer' | translate }}</button>
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'hrmEmp.transfer' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="visible.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzFor="tr-dept">{{ 'hrmOrg.department' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('to_department_id')">
              <nz-select id="tr-dept" formControlName="to_department_id" nzAllowClear nzShowSearch>
                @for (d of departments(); track d.id) {
                  <nz-option [nzValue]="d.id" [nzLabel]="d.code + ' - ' + d.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="tr-pos">{{ 'hrmOrg.position' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('to_position_id')">
              <nz-select id="tr-pos" formControlName="to_position_id" nzAllowClear nzShowSearch>
                @for (p of positions(); track p.id) {
                  <nz-option [nzValue]="p.id" [nzLabel]="p.code + ' - ' + p.title" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="tr-date">{{ 'hrmEmp.effectiveDate' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('effective_date')">
              <input nz-input id="tr-date" type="date" formControlName="effective_date" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="tr-reason">{{ 'hrmCommon.reason' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('reason')">
              <textarea nz-input id="tr-reason" rows="2" formControlName="reason"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class EmployeeTransferComponent {
  readonly employeeId = input.required<string>();
  readonly transferred = output<void>();

  private readonly api = inject(HrEmployeeApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly visible = signal(false);
  protected readonly saving = signal(false);
  protected readonly departments = signal<DepartmentResource[]>([]);
  protected readonly positions = signal<PositionResource[]>([]);

  protected readonly form = this.fb.group({
    to_department_id: [''],
    to_position_id: [''],
    effective_date: [''],
    reason: ['', Validators.maxLength(500)],
  });

  protected open(): void {
    this.form.reset();
    this.visible.set(true);
    this.api.getDepartments().subscribe({ next: (res) => this.departments.set(res.data) });
    this.api.getPositions().subscribe({ next: (res) => this.positions.set(res.data) });
  }

  protected error(key: string): string {
    const errors = this.form.get(key)?.errors;
    if (errors?.['serverError']) {
      return String(errors['serverError']);
    }
    return errors ? this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE') : '';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .transferEmployee(this.employeeId(), {
        to_department_id: value.to_department_id || null,
        to_position_id: value.to_position_id || null,
        effective_date: value.effective_date || null,
        reason: value.reason || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.message.success(this.i18n.translate('hrmEmp.transferred'));
          this.transferred.emit();
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
