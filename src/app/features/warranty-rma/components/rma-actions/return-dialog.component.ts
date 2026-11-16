import { Component, effect, inject, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { applyServerErrors, DdtCausale, I18nService, RmaOrder, serverErrorMessage } from '@core';
import { TranslatePipe } from '@shared';
import { ActionResult } from '../../state/action-result';
import { RmaDetailStore } from '../../state/rma-detail.store';
import { DDT_CAUSALI } from '../../utils/rma-status';
import { toApiDateTime } from './date-input';

/** Return to customer (DDT causale and VAT flag only; no document is generated here). */
@Component({
  selector: 'app-rma-return-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzCheckboxModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'RMA.ACTIONS.RETURN' | translate"
      [nzOkText]="'COMMON.CONFIRM' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzFor="ret-at">{{ 'RMA.FIELDS.RETURNED_AT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('returned_at')">
              <input nz-input type="datetime-local" id="ret-at" formControlName="returned_at" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ret-ddt">{{ 'RMA.FIELDS.DDT_RETURN' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('ddt_causale_return')">
              <nz-select nzId="ret-ddt" formControlName="ddt_causale_return">
                @for (c of causali; track c) {
                  <nz-option [nzValue]="c" [nzLabel]="'RMA.DDT.' + c.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control [nzErrorTip]="errorTip('vat_exempt_art15_dpr633')">
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-checkbox formControlName="vat_exempt_art15_dpr633">{{
                'RMA.FIELDS.VAT_EXEMPT_ART15' | translate
              }}</label>
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
export class ReturnDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(RmaDetailStore);

  readonly open = model(false);
  readonly finished = output<ActionResult<RmaOrder>>();
  readonly causali = DDT_CAUSALI;
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    returned_at: this.fb.control(''),
    ddt_causale_return: this.fb.control<DdtCausale>('reso_riparato'),
    vat_exempt_art15_dpr633: this.fb.control(false),
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
    return (
      serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')
    );
  }

  async submit(): Promise<void> {
    const v = this.form.getRawValue();
    const res = await this.store.returnToCustomer({
      returned_at: toApiDateTime(v.returned_at),
      ddt_causale_return: v.ddt_causale_return,
      vat_exempt_art15_dpr633: v.vat_exempt_art15_dpr633,
    });
    if (!res.ok && res.status === 422) {
      this.formErrors.set(applyServerErrors(this.form, res.error));
      return;
    }
    this.open.set(false);
    this.finished.emit(res);
  }
}
