import { Component, effect, inject, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  DdtCausale,
  I18nService,
  Loaner,
  LoanerRegisterType,
  serverErrorMessage,
} from '@core';
import { TranslatePipe } from '@shared';
import { ActionResult } from '../../state/action-result';
import { RmaDetailStore } from '../../state/rma-detail.store';
import { toApiDate, toApiDateTime } from './date-input';

/** Issues a loaner unit to the customer (register "prestito d'uso"). */
@Component({
  selector: 'app-rma-issue-loaner-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'RMA.ACTIONS.ISSUE_LOANER' | translate"
      [nzOkText]="'COMMON.CONFIRM' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ln-serial">{{
              'RMA.LOANER.SERIAL' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('loaner_serial_number')">
              <input nz-input id="ln-serial" formControlName="loaner_serial_number" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ln-register">{{
              'RMA.LOANER.REGISTER' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('register_type')">
              <nz-select nzId="ln-register" formControlName="register_type">
                <nz-option
                  nzValue="prestito_uso"
                  [nzLabel]="'RMA.REGISTER.PRESTITO_USO' | translate"
                />
                <nz-option
                  nzValue="conto_riparazione"
                  [nzLabel]="'RMA.REGISTER.CONTO_RIPARAZIONE' | translate"
                />
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ln-issued">{{
              'RMA.LOANER.ISSUED_AT' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('issued_at')">
              <input nz-input type="datetime-local" id="ln-issued" formControlName="issued_at" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ln-expected">{{
              'RMA.LOANER.EXPECTED_RETURN' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('expected_return_at')">
              <input nz-input type="date" id="ln-expected" formControlName="expected_return_at" />
            </nz-form-control>
          </nz-form-item>
          @for (msg of formErrors(); track msg) {
            <p class="rma-form-error" role="alert">{{ msg }}</p>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class IssueLoanerDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(RmaDetailStore);

  readonly open = model(false);
  readonly finished = output<ActionResult<Loaner>>();
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    loaner_serial_number: this.fb.control('', Validators.required),
    register_type: this.fb.control<LoanerRegisterType>('prestito_uso', Validators.required),
    issued_at: this.fb.control(''),
    expected_return_at: this.fb.control(''),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.formErrors.set([]);
      }
    });
  }

  errorTip(path: string): string {
    return serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.REQUIRED');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }
    const v = this.form.getRawValue();
    const ddt: DdtCausale =
      v.register_type === 'prestito_uso' ? 'prestito_uso' : 'conto_riparazione';
    const res = await this.store.issueLoaner({
      loaner_serial_number: v.loaner_serial_number.trim(),
      register_type: v.register_type,
      issued_at: toApiDateTime(v.issued_at),
      expected_return_at: toApiDate(v.expected_return_at),
      ddt_causale: ddt,
    });
    if (!res.ok && res.status === 422) {
      this.formErrors.set(applyServerErrors(this.form, res.error));
      return;
    }
    this.open.set(false);
    this.finished.emit(res);
  }
}
