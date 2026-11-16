import { Component, effect, inject, model, output, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { applyServerErrors, I18nService, ReceiptPhoto, RmaOrder, serverErrorMessage } from '@core';
import { TranslatePipe } from '@shared';
import { ActionResult } from '../../state/action-result';
import { RmaDetailStore } from '../../state/rma-detail.store';
import { toApiDateTime } from './date-input';

type PhotoRow = FormGroup<{ ref: FormControl<string>; caption: FormControl<string> }>;

/** Goods receipt: condition notes and photo references (URL or uploaded asset id). */
@Component({
  selector: 'app-rma-receive-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'RMA.ACTIONS.RECEIVE' | translate"
      [nzWidth]="640"
      [nzOkText]="'COMMON.CONFIRM' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzFor="rcv-at">{{ 'RMA.FIELDS.RECEIVED_AT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('received_at')">
              <input nz-input type="datetime-local" id="rcv-at" formControlName="received_at" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="rcv-notes">{{
              'RMA.FIELDS.CONDITION_NOTES' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('receipt_condition_notes')">
              <textarea
                nz-input
                id="rcv-notes"
                rows="3"
                formControlName="receipt_condition_notes"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
          <h4>{{ 'RMA.FIELDS.PHOTOS' | translate }}</h4>
          <div formArrayName="receipt_photos">
            @for (row of form.controls.receipt_photos.controls; track row; let i = $index) {
              <div class="rma-row-grid" [formGroupName]="i">
                <nz-form-item>
                  <nz-form-label nzRequired [nzFor]="'rcv-ref-' + i">{{
                    'RMA.FIELDS.PHOTO_REF' | translate
                  }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="errorTip('receipt_photos.' + i + '.url')">
                    <input nz-input [id]="'rcv-ref-' + i" formControlName="ref" />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label [nzFor]="'rcv-cap-' + i">{{
                    'RMA.FIELDS.CAPTION' | translate
                  }}</nz-form-label>
                  <nz-form-control>
                    <input nz-input [id]="'rcv-cap-' + i" formControlName="caption" />
                  </nz-form-control>
                </nz-form-item>
                <button
                  nz-button
                  nzDanger
                  type="button"
                  class="rma-row-remove"
                  (click)="form.controls.receipt_photos.removeAt(i)"
                  [attr.aria-label]="'RMA.ACTIONS.REMOVE_ROW' | translate"
                >
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            }
          </div>
          <button nz-button nzType="dashed" type="button" (click)="addPhoto()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>&nbsp;{{
              'RMA.ACTIONS.ADD_PHOTO' | translate
            }}
          </button>
          @for (msg of formErrors(); track msg) {
            <p class="rma-form-error" role="alert">{{ msg }}</p>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ReceiveDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(RmaDetailStore);

  readonly open = model(false);
  readonly finished = output<ActionResult<RmaOrder>>();
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    received_at: this.fb.control(''),
    receipt_condition_notes: this.fb.control(''),
    receipt_photos: this.fb.array<PhotoRow>([]),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.form.controls.receipt_photos.clear();
        this.formErrors.set([]);
      }
    });
  }

  addPhoto(): void {
    this.form.controls.receipt_photos.push(
      this.fb.group({
        ref: this.fb.control('', Validators.required),
        caption: this.fb.control(''),
      }),
    );
  }

  errorTip(path: string): string {
    return serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.REQUIRED');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.controls.receipt_photos.controls.forEach((g) => g.controls.ref.markAsDirty());
      return;
    }
    const v = this.form.getRawValue();
    const photos: ReceiptPhoto[] = v.receipt_photos.map((p) => {
      const ref = p.ref.trim();
      const caption = p.caption.trim() || null;
      return /^https?:\/\//i.test(ref) ? { url: ref, caption } : { asset_id: ref, caption };
    });
    const res = await this.store.receive({
      received_at: toApiDateTime(v.received_at),
      receipt_condition_notes: v.receipt_condition_notes.trim() || null,
      receipt_photos: photos,
    });
    if (!res.ok && res.status === 422) {
      this.formErrors.set(applyServerErrors(this.form, res.error));
      return;
    }
    this.open.set(false);
    this.finished.emit(res);
  }
}
