import { Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { applyServerErrors, EmployeeResource, HrApiService, HrExtraApiService, I18nService, isValidationError } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { reportHttpError } from '../shared/hr-http.util';

/** Edits the contact data of an employee and archives the record (PUT / DELETE /hr/employees/{id}). */
@Component({
  selector: 'app-employee-edit',
  imports: [ModalActionsDirective, ReactiveFormsModule, NzButtonModule, NzFormModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <button nz-button type="button" (click)="open()">{{ 'hrmCommon.edit' | translate }}</button>
    @if (employee().employment_status === 'terminated') {
      <button nz-button type="button" (click)="confirmRehire()">{{ 'hrmEmp.rehire' | translate }}</button>
    }
    <button nz-button nzDanger type="button" (click)="confirmArchive()">{{ 'hrmEmp.archive' | translate }}</button>
    <nz-modal appModalActions
      [nzVisible]="visible()"
      [nzTitle]="'hrmCommon.edit' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="visible.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ee-first">{{ 'hrmRecruiting.firstName' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('first_name')">
              <input nz-input id="ee-first" maxlength="100" formControlName="first_name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ee-last">{{ 'hrmRecruiting.lastName' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('last_name')">
              <input nz-input id="ee-last" maxlength="100" formControlName="last_name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ee-phone">{{ 'hrmRecruiting.phone' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('phone')">
              <input nz-input id="ee-phone" maxlength="50" formControlName="phone" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ee-mail">{{ 'hrmEmp.personalEmail' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="error('personal_email')">
              <input nz-input id="ee-mail" type="email" maxlength="180" formControlName="personal_email" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class EmployeeEditComponent {
  readonly employee = input.required<EmployeeResource>();
  readonly saved = output<void>();
  readonly archived = output<void>();

  private readonly api = inject(HrExtraApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly visible = signal(false);
  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    phone: ['', Validators.maxLength(50)],
    personal_email: ['', [Validators.email, Validators.maxLength(180)]],
  });

  protected open(): void {
    const e = this.employee();
    this.form.reset({
      first_name: e.first_name,
      last_name: e.last_name,
      phone: e.phone ?? '',
      personal_email: e.personal_email ?? '',
    });
    this.visible.set(true);
  }

  protected error(key: string): string {
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
    return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .updateEmployee(this.employee().id, {
        first_name: value.first_name.trim(),
        last_name: value.last_name.trim(),
        phone: value.phone.trim() || null,
        personal_email: value.personal_email.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.message.success(this.i18n.translate('hrmCommon.saved'));
          this.saved.emit();
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

  protected confirmRehire(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('hrmEmp.rehire'),
      nzContent: this.i18n.translate('hrmEmp.rehireConfirm'),
      nzOnOk: () =>
        this.hrApi.rehireEmployee(this.employee().id, { rehire_date: new Date().toISOString().slice(0, 10) }).subscribe({
          next: () => {
            this.message.success(this.i18n.translate('hrmEmp.rehired'));
            this.saved.emit();
          },
          error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
        }),
    });
  }

  protected confirmArchive(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('hrmEmp.archive'),
      nzContent: this.i18n.translate('hrmEmp.archiveConfirm'),
      nzOkDanger: true,
      nzOnOk: () =>
        this.api.deleteEmployee(this.employee().id).subscribe({
          next: () => {
            this.message.success(this.i18n.translate('hrmEmp.archived'));
            this.archived.emit();
          },
          error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
        }),
    });
  }
}
