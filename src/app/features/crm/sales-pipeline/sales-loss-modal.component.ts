import { Component, computed, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { I18nService, type SalesLossAnswer, type SalesLossReason } from '@core';
import { TranslatePipe } from '@shared';

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/**
 * The mandatory loss questionnaire: shown whenever a deal is dropped on a lost stage. The loss reason (from the
 * localized catalog served by the API) and the winning competitor are both required; the notes are optional.
 */
@Component({
  selector: 'app-sales-loss-modal',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzSelectModule,
    NzInputModule,
    NzButtonModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'SALESPIPE.LOSS_TITLE' | translate"
      [nzFooter]="footer"
      [nzMaskClosable]="false"
      (nzOnCancel)="cancel()"
    >
      <ng-container *nzModalContent>
        <p class="loss-intro">
          {{ 'SALESPIPE.LOSS_INTRO' | translate }} <strong>{{ dealName() }}</strong>
        </p>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SALESPIPE.LOSS_REASON' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="reasonError()">
              <nz-select formControlName="reason" class="full-width" data-testid="loss-reason">
                @for (reason of reasons(); track reason.id) {
                  <nz-option [nzValue]="reason.code" [nzLabel]="reason.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SALESPIPE.COMPETITOR' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="competitorError()">
              <input
                nz-input
                formControlName="competitor"
                maxlength="150"
                data-testid="loss-competitor"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'SALESPIPE.LOSS_NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input rows="3" maxlength="2000" formControlName="notes"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
    <ng-template #footer>
      <button nz-button type="button" (click)="cancel()">
        {{ 'SALESPIPE.CANCEL' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        nzDanger
        type="button"
        data-testid="loss-confirm"
        (click)="submit()"
      >
        {{ 'SALESPIPE.CONFIRM_LOSS' | translate }}
      </button>
    </ng-template>
  `,
  styles: `
    .full-width {
      width: 100%;
    }
    .loss-intro {
      margin-bottom: 16px;
    }
  `,
})
export class SalesLossModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);

  readonly visible = input.required<boolean>();
  readonly dealName = input<string>('');
  readonly reasons = input.required<SalesLossReason[]>();
  /** Validation errors returned by the API (field => messages), shown under the fields. */
  readonly serverErrors = input<Record<string, string[]>>({});

  readonly confirmed = output<SalesLossAnswer>();
  readonly cancelled = output<void>();

  readonly form = this.fb.group({
    reason: this.fb.control('', [Validators.required]),
    competitor: this.fb.control('', [notBlank, Validators.maxLength(150)]),
    notes: this.fb.control('', [Validators.maxLength(2000)]),
  });

  readonly reasonError = computed(() => {
    this.i18n.currentLanguage();
    return (
      this.serverErrors()['loss_reason_code']?.[0] ??
      this.i18n.translate('SALESPIPE.LOSS_REASON_REQUIRED')
    );
  });
  readonly competitorError = computed(() => {
    this.i18n.currentLanguage();
    return (
      this.serverErrors()['competitor']?.[0] ?? this.i18n.translate('SALESPIPE.COMPETITOR_REQUIRED')
    );
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ reason: '', competitor: '', notes: '' });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Object.values(this.form.controls).forEach((control) => control.updateValueAndValidity());
      return;
    }

    const value = this.form.getRawValue();
    this.confirmed.emit({
      loss_reason_code: value.reason,
      competitor: value.competitor.trim(),
      loss_notes: value.notes.trim() === '' ? null : value.notes.trim(),
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
