import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { I18nService, isValidationError, RmaOrder } from '@core';
import { TranslatePipe } from '@shared';
import { ActionResult } from '../../state/action-result';
import { RmaDetailStore } from '../../state/rma-detail.store';

export type NoteActionKind = 'cancel' | 'approve_estimate' | 'decline_estimate';

const CONFIG: Record<
  NoteActionKind,
  { title: string; label: string; required: boolean; danger: boolean }
> = {
  cancel: {
    title: 'RMA.ACTIONS.CANCEL',
    label: 'RMA.FIELDS.CANCEL_REASON',
    required: true,
    danger: true,
  },
  approve_estimate: {
    title: 'RMA.ACTIONS.APPROVE_ESTIMATE',
    label: 'RMA.FIELDS.NOTE',
    required: false,
    danger: false,
  },
  decline_estimate: {
    title: 'RMA.ACTIONS.DECLINE_ESTIMATE',
    label: 'RMA.FIELDS.NOTE',
    required: false,
    danger: true,
  },
};

/** Cancel (reason required) and staff approve/decline of the estimate on behalf of the customer. */
@Component({
  selector: 'app-rma-note-action-dialog',
  imports: [ReactiveFormsModule, NzModalModule, NzFormModule, NzInputModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="config().title | translate"
      [nzOkText]="'COMMON.CONFIRM' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkDanger]="config().danger"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        @if (kind() !== 'cancel') {
          <p>{{ 'RMA.ESTIMATE.ON_BEHALF_HINT' | translate }}</p>
        }
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label [nzRequired]="config().required" nzFor="note-action-text">{{
              config().label | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip()">
              <textarea nz-input id="note-action-text" rows="3" formControlName="text"></textarea>
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
export class NoteActionDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(RmaDetailStore);

  readonly open = model(false);
  readonly kind = input<NoteActionKind>('cancel');
  readonly finished = output<ActionResult<RmaOrder>>();

  readonly config = computed(() => CONFIG[this.kind()]);
  readonly formErrors = signal<string[]>([]);
  readonly form = this.fb.group({ text: this.fb.control('') });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const control = this.form.controls.text;
      control.reset('');
      control.setValidators(
        this.config().required ? [Validators.required, Validators.maxLength(1000)] : [],
      );
      control.updateValueAndValidity();
      this.formErrors.set([]);
    });
  }

  errorTip(): string {
    const error = this.form.controls.text.errors?.['serverError'];
    return typeof error === 'string' ? error : this.i18n.translate('COMMON.VALIDATION.REQUIRED');
  }

  async submit(): Promise<void> {
    const control = this.form.controls.text;
    if (control.invalid) {
      control.markAsDirty();
      control.updateValueAndValidity();
      return;
    }
    const text = control.value.trim();
    const kind = this.kind();
    const res =
      kind === 'cancel'
        ? await this.store.cancel({ reason: text })
        : kind === 'approve_estimate'
          ? await this.store.approveEstimate({ note: text || null })
          : await this.store.declineEstimate({ note: text || null });
    if (!res.ok && isValidationError(res.error)) {
      // Backend field is `reason` (cancel) or `note` (estimate decisions): both bind to the text control.
      const errors: Record<string, string[]> = res.error.error.errors;
      const message = errors['reason']?.[0] ?? errors['note']?.[0];
      if (message) {
        control.setErrors({ serverError: message });
        control.markAsDirty();
      }
      this.formErrors.set(
        Object.entries(errors)
          .filter(([field]) => field !== 'reason' && field !== 'note')
          .map(([, messages]) => messages[0]),
      );
      return;
    }
    this.open.set(false);
    this.finished.emit(res);
  }
}
