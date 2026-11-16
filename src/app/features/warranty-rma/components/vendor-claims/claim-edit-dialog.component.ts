import { Component, effect, inject, input, model, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { applyServerErrors, I18nService, serverErrorMessage, VendorClaim } from '@core';
import { TranslatePipe } from '@shared';
import { VendorClaimStore } from '../../state/vendor-claim.store';
import { toAmount } from '../../utils/rma-status';

/** Edits the supplier RMA reference, notes and claimed amount of a claim. */
@Component({
  selector: 'app-claim-edit-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'RMA.CLAIMS.EDIT' | translate"
      [nzOkText]="'COMMON.SAVE' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzFor="vc-ref">{{
              'RMA.CLAIMS.SUPPLIER_RMA' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('supplier_rma_reference')">
              <input nz-input id="vc-ref" formControlName="supplier_rma_reference" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="vc-amount">{{ 'RMA.CLAIMS.AMOUNT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('claimed_amount')">
              <nz-input-number
                nzId="vc-amount"
                formControlName="claimed_amount"
                [nzMin]="0"
                [nzPrecision]="2"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="vc-notes">{{ 'RMA.FIELDS.NOTE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('notes')">
              <textarea nz-input id="vc-notes" rows="3" formControlName="notes"></textarea>
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
export class ClaimEditDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(VendorClaimStore);

  readonly open = model(false);
  readonly claim = input<VendorClaim | null>(null);
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    supplier_rma_reference: this.fb.control(''),
    claimed_amount: this.fb.control<number | null>(null),
    notes: this.fb.control(''),
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const c = this.claim();
      this.form.reset({
        supplier_rma_reference: c?.supplier_rma_reference ?? '',
        claimed_amount: toAmount(c?.claimed_amount),
        notes: c?.notes ?? '',
      });
      this.formErrors.set([]);
    });
  }

  errorTip(path: string): string {
    return (
      serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')
    );
  }

  async submit(): Promise<void> {
    const id = this.claim()?.id;
    if (!id) {
      return;
    }
    const v = this.form.getRawValue();
    const res = await this.store.patch(id, {
      supplier_rma_reference: v.supplier_rma_reference.trim() || null,
      claimed_amount: v.claimed_amount,
      notes: v.notes.trim() || null,
    });
    if (!res.ok && res.status === 422) {
      this.formErrors.set(applyServerErrors(this.form, res.error));
      return;
    }
    this.open.set(false);
  }
}
