import { Component, effect, inject, input, model, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { applyServerErrors, DdtCausale, I18nService, serverErrorMessage } from '@core';
import { TranslatePipe } from '@shared';
import { SerialLookupStore } from '../../state/serial-lookup.store';
import { DDT_CAUSALI } from '../../utils/rma-status';

/** "Issue RMA" form for the looked-up passport; on success the store exposes the label. */
@Component({
  selector: 'app-issue-rma-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzCheckboxModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'RMA.ISSUE.TITLE' | translate"
      [nzOkText]="'RMA.ISSUE.SUBMIT' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.issuing()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="issue-symptom">{{
              'RMA.FIELDS.SYMPTOM' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('reported_symptom')">
              <textarea
                nz-input
                id="issue-symptom"
                rows="4"
                formControlName="reported_symptom"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="issue-threshold">{{
              'RMA.FIELDS.THRESHOLD' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('preauthorized_threshold')">
              <nz-input-number
                nzId="issue-threshold"
                formControlName="preauthorized_threshold"
                [nzMin]="0"
                [nzStep]="10"
                [nzPrecision]="2"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="issue-ddt">{{
              'RMA.FIELDS.DDT_OUTBOUND' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('ddt_causale_outbound')">
              <nz-select nzId="issue-ddt" formControlName="ddt_causale_outbound">
                @for (c of causali; track c) {
                  <nz-option [nzValue]="c" [nzLabel]="'RMA.DDT.' + c.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (outOfWarranty()) {
            <nz-form-item>
              <nz-form-control [nzErrorTip]="errorTip('goodwill')">
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label nz-checkbox formControlName="goodwill">{{
                  'RMA.ISSUE.GOODWILL' | translate
                }}</label>
              </nz-form-control>
            </nz-form-item>
          }
          @for (msg of formErrors(); track msg) {
            <p class="rma-form-error" role="alert">{{ msg }}</p>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class IssueRmaDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(SerialLookupStore);

  readonly open = model(false);
  readonly passportId = input.required<string>();
  readonly outOfWarranty = input(false);

  readonly causali = DDT_CAUSALI;
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    reported_symptom: this.fb.control('', [Validators.required, Validators.maxLength(2000)]),
    preauthorized_threshold: this.fb.control<number | null>(0),
    ddt_causale_outbound: this.fb.control<DdtCausale>('conto_riparazione'),
    goodwill: this.fb.control(false),
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
    const res = await this.store.issueRma({
      equipment_passport_id: this.passportId(),
      reported_symptom: v.reported_symptom.trim(),
      preauthorized_threshold: v.preauthorized_threshold ?? 0,
      ddt_causale_outbound: v.ddt_causale_outbound,
      goodwill: this.outOfWarranty() ? v.goodwill : undefined,
    });
    if (res.ok) {
      this.open.set(false);
      return;
    }
    this.formErrors.set(applyServerErrors(this.form, res.error));
  }
}
