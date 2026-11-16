import { Component, effect, inject, input, model, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { applyServerErrors, I18nService, serverErrorMessage } from '@core';
import { TranslatePipe } from '@shared';
import { PassportStore } from '../../state/passport.store';

/** Adds an extended care pack; the backend recomputes the effective expiry. */
@Component({
  selector: 'app-add-extension-dialog',
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
      [nzTitle]="'RMA.PASSPORT.ADD_EXTENSION' | translate"
      [nzOkText]="'COMMON.SAVE' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ext-name">{{
              'RMA.EXTENSION.NAME' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('name')">
              <input nz-input id="ext-name" formControlName="name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ext-months">{{
              'RMA.EXTENSION.MONTHS' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('months')">
              <nz-input-number
                nzId="ext-months"
                formControlName="months"
                [nzMin]="1"
                [nzMax]="120"
                [nzStep]="1"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ext-start">{{
              'RMA.EXTENSION.STARTS_AT' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('starts_at')">
              <input nz-input type="date" id="ext-start" formControlName="starts_at" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ext-ref">{{
              'RMA.EXTENSION.REFERENCE' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('reference')">
              <input nz-input id="ext-ref" formControlName="reference" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ext-price">{{ 'RMA.EXTENSION.PRICE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('price')">
              <nz-input-number
                nzId="ext-price"
                formControlName="price"
                [nzMin]="0"
                [nzPrecision]="2"
              />
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
export class AddExtensionDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(PassportStore);

  readonly open = model(false);
  readonly passportId = input.required<string>();
  /** Default start: the current warranty expiry. */
  readonly defaultStart = input<string | null>(null);
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    months: this.fb.control<number | null>(12, [Validators.required, Validators.min(1)]),
    starts_at: this.fb.control('', Validators.required),
    reference: this.fb.control(''),
    price: this.fb.control<number | null>(null),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.form.patchValue({ starts_at: this.defaultStart() ?? '' });
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
    const res = await this.store.addExtension(this.passportId(), {
      name: v.name.trim(),
      months: v.months ?? 12,
      starts_at: v.starts_at,
      reference: v.reference.trim() || null,
      price: v.price,
    });
    if (res.ok) {
      this.open.set(false);
      return;
    }
    this.formErrors.set(applyServerErrors(this.form, res.error));
  }
}
