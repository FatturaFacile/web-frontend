import { Component, effect, input, model, output, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { REJECTION_REASON_CODES, RejectionReasonCode } from '@core';
import { TranslatePipe } from '@shared';

export interface RejectDecision {
  rejection_reason_code: RejectionReasonCode;
  rejection_note: string | null;
  send_email: boolean;
}

interface RejectModel {
  reason: RejectionReasonCode | null;
  note: string;
  sendEmail: boolean;
}

const EMPTY: RejectModel = { reason: null, note: '', sendEmail: true };

/** Collects the mandatory rejection reason before a card is moved to `rejected`. */
@Component({
  selector: 'app-reject-dialog',
  imports: [
    FormField,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'hr.recruiting.reject.title' | translate: { name: candidateName() }"
      [nzFooter]="footer"
      (nzOnCancel)="cancel()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" (submit)="$event.preventDefault(); confirm()">
          <nz-form-item>
            <nz-form-label nzFor="reject-reason" nzRequired>{{
              'hr.recruiting.reject.reason' | translate
            }}</nz-form-label>
            <nz-form-control
              [nzValidateStatus]="showReasonError() ? 'error' : ''"
              [nzErrorTip]="'hr.recruiting.validation.required' | translate"
            >
              <nz-select
                nzId="reject-reason"
                [formField]="rejectForm.reason"
                [nzPlaceHolder]="'hr.recruiting.reject.reasonPlaceholder' | translate"
              >
                @for (code of reasons; track code) {
                  <nz-option
                    [nzValue]="code"
                    [nzLabel]="'hr.recruiting.rejectionReasons.' + code | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="reject-note">{{
              'hr.recruiting.reject.note' | translate
            }}</nz-form-label>
            <nz-form-control>
              <textarea id="reject-note" nz-input rows="3" [formField]="rejectForm.note"></textarea>
            </nz-form-control>
          </nz-form-item>
          <label
            nz-checkbox
            nzId="reject-send-email"
            for="reject-send-email"
            [formField]="rejectForm.sendEmail"
            >{{ 'hr.recruiting.reject.sendEmail' | translate }}</label
          >
        </form>
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" (click)="cancel()">
          {{ 'common.actions.cancel' | translate }}
        </button>
        <button nz-button nzType="primary" nzDanger type="button" (click)="confirm()">
          {{ 'hr.recruiting.reject.confirm' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class RejectDialogComponent {
  readonly open = model(false);
  readonly candidateName = input('');
  readonly confirmed = output<RejectDecision>();
  readonly cancelled = output<void>();

  readonly reasons = REJECTION_REASON_CODES;
  readonly model = signal<RejectModel>({ ...EMPTY });
  readonly rejectForm = form(this.model, (p) => {
    required(p.reason);
  });
  readonly submitted = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.model.set({ ...EMPTY });
        this.submitted.set(false);
      }
    });
  }

  showReasonError(): boolean {
    return this.submitted() && this.rejectForm.reason().invalid();
  }

  confirm(): void {
    this.submitted.set(true);
    const value = this.model();
    if (!value.reason) {
      return;
    }
    this.confirmed.emit({
      rejection_reason_code: value.reason,
      rejection_note: value.note.trim() || null,
      send_email: value.sendEmail,
    });
    this.open.set(false);
  }

  cancel(): void {
    this.open.set(false);
    this.cancelled.emit();
  }
}
