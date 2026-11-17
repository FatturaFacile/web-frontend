import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  I18nService,
  serverErrorMessage,
  VendorClaim,
  VendorClaimStatus,
} from '@core';
import { TranslatePipe } from '@shared';
import { VendorClaimStore } from '../../state/vendor-claim.store';
import {
  nextVendorClaimStatuses,
  requiresCreditNoteReference,
  vendorClaimTag,
} from '../../utils/rma-status';

/** Moves a claim to one of its legal next states; a credit note approval needs the reference. */
@Component({
  selector: 'app-claim-transition-dialog',
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
      [nzTitle]="'RMA.CLAIMS.TRANSITION' | translate"
      [nzOkText]="'COMMON.CONFIRM' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="vct-to">{{
              'RMA.CLAIMS.NEXT_STATUS' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('to')">
              <nz-select nzId="vct-to" formControlName="to">
                @for (s of nextStatuses(); track s) {
                  <nz-option [nzValue]="s" [nzLabel]="vendorClaimTag(s).labelKey | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (needsCreditNote()) {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="vct-credit">{{
                'RMA.CLAIMS.CREDIT_NOTE' | translate
              }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('credit_note_reference')">
                <input nz-input id="vct-credit" formControlName="credit_note_reference" />
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label nzFor="vct-note">{{ 'RMA.FIELDS.NOTE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('note')">
              <textarea nz-input id="vct-note" rows="2" formControlName="note"></textarea>
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
export class ClaimTransitionDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(VendorClaimStore);

  readonly open = model(false);
  readonly claim = input<VendorClaim | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly vendorClaimTag = vendorClaimTag;

  readonly form = this.fb.group({
    to: this.fb.control<VendorClaimStatus | null>(null, Validators.required),
    credit_note_reference: this.fb.control(''),
    note: this.fb.control(''),
  });

  readonly nextStatuses = computed(() => nextVendorClaimStatuses(this.claim()?.status ?? ''));
  private readonly to = toSignal(this.form.controls.to.valueChanges, { initialValue: null });
  readonly needsCreditNote = computed(() => requiresCreditNoteReference(this.to()));

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const next = this.nextStatuses();
      this.form.reset({
        to: next.length === 1 ? next[0] : null,
        credit_note_reference: '',
        note: '',
      });
      this.formErrors.set([]);
    });
    effect(() => {
      const control = this.form.controls.credit_note_reference;
      control.setValidators(this.needsCreditNote() ? [Validators.required] : []);
      control.updateValueAndValidity();
    });
  }

  errorTip(path: string): string {
    return serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.REQUIRED');
  }

  async submit(): Promise<void> {
    const id = this.claim()?.id;
    if (!id) {
      return;
    }
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }
    const v = this.form.getRawValue();
    if (!v.to) {
      return;
    }
    const res = await this.store.transition(id, {
      to: v.to,
      credit_note_reference: requiresCreditNoteReference(v.to)
        ? v.credit_note_reference.trim()
        : null,
      note: v.note.trim() || null,
    });
    if (!res.ok && res.status === 422) {
      this.formErrors.set(applyServerErrors(this.form, res.error));
      return;
    }
    this.open.set(false);
  }
}
