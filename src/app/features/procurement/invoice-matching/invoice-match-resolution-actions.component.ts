import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { I18nService } from '@core/i18n';
import { InvoiceMatchRun } from '@domain/procurement/invoice-matching.models';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  blockingLines,
  canResolve,
  MIN_OVERRIDE_REASON_LENGTH,
  reasonKey,
} from './invoice-matching.helpers';
import { InvoiceMatchingStore, MatchingOutcome } from './invoice-matching.store';

type ResolutionDialog = 'credit_note' | 'rematch' | 'partial' | 'override';

/** Validator: the trimmed text must reach `min` characters (the API trims the reason too). */
function trimmedMinLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null =>
    String(control.value ?? '').trim().length >= min ? null : { trimmedMinLength: { min } };
}

/**
 * Resolution controls of a blocked run: request a credit note, re-match, partially resolve selected lines and the
 * supervisor / CFO override. Nothing is rendered while the run does not block the payment.
 */
@Component({
  selector: 'app-invoice-match-resolution-actions',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzTagModule,
  ],
  template: `
    @if (blocking()) {
      <div class="actions" data-testid="resolution-actions">
        <button
          nz-button
          type="button"
          (click)="open('credit_note')"
          data-testid="action-credit-note"
        >
          {{ 'invoiceMatching.button.requestCreditNote' | translate }}
        </button>
        <button nz-button type="button" (click)="open('rematch')" data-testid="action-rematch">
          {{ 'invoiceMatching.button.rematch' | translate }}
        </button>
        <button nz-button type="button" (click)="open('partial')" data-testid="action-partial">
          {{ 'invoiceMatching.button.partialResolution' | translate }}
        </button>
        <button
          nz-button
          nzDanger
          type="button"
          (click)="open('override')"
          data-testid="action-override"
        >
          {{ 'invoiceMatching.button.override' | translate }}
        </button>
      </div>
    }

    <nz-modal
      [nzVisible]="dialog() === 'credit_note'"
      [nzTitle]="'invoiceMatching.form.creditNoteModalTitle' | translate"
      [nzOkText]="'invoiceMatching.button.confirm' | translate"
      [nzCancelText]="'invoiceMatching.button.cancel' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="creditForm.invalid"
      (nzOnOk)="submitCreditNote()"
      (nzOnCancel)="close()"
      data-testid="credit-note-modal"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="creditForm">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="credit-reason">{{
              'invoiceMatching.form.reason' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'invoiceMatching.form.reasonRequired' | translate">
              <textarea nz-input id="credit-reason" rows="3" formControlName="reason"></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="credit-amount">{{
              'invoiceMatching.form.expectedCreditAmount' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number
                nzId="credit-amount"
                formControlName="expected_credit_amount"
                [nzMin]="0"
                [nzStep]="0.01"
              />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'rematch'"
      [nzTitle]="'invoiceMatching.form.rematchModalTitle' | translate"
      [nzOkText]="'invoiceMatching.button.rematch' | translate"
      [nzCancelText]="'invoiceMatching.button.cancel' | translate"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="submitRematch()"
      (nzOnCancel)="close()"
      data-testid="rematch-modal"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="rematchForm">
          <nz-form-item>
            <nz-form-label nzFor="rematch-reason">{{
              'invoiceMatching.form.reasonOptional' | translate
            }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input id="rematch-reason" rows="3" formControlName="reason"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'partial'"
      [nzTitle]="'invoiceMatching.form.partialModalTitle' | translate"
      [nzOkText]="'invoiceMatching.button.confirm' | translate"
      [nzCancelText]="'invoiceMatching.button.cancel' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="partialForm.invalid || selectedLineIds().length === 0"
      (nzOnOk)="submitPartial()"
      (nzOnCancel)="close()"
      data-testid="partial-modal"
    >
      <ng-container *nzModalContent>
        <p>{{ 'invoiceMatching.form.selectBlockingLines' | translate }}</p>
        <ul class="lines" data-testid="partial-lines">
          @for (line of lines(); track line.id) {
            <li>
              <label
                [attr.for]="'partial-input-' + line.id"
                [nzId]="'partial-input-' + line.id"
                nz-checkbox
                [nzChecked]="isSelected(line.id)"
                (nzCheckedChange)="toggleLine(line.id, $event)"
                [attr.data-testid]="'partial-line-' + line.id"
              >
                #{{ line.line_number }} {{ line.description }}
              </label>
              @for (reason of line.reasons; track reason) {
                <nz-tag>{{ reasonText(reason) | translate }}</nz-tag>
              }
            </li>
          }
        </ul>
        <form nz-form nzLayout="vertical" [formGroup]="partialForm">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="partial-reason">{{
              'invoiceMatching.form.reason' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'invoiceMatching.form.reasonRequired' | translate">
              <textarea nz-input id="partial-reason" rows="3" formControlName="reason"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'override'"
      [nzTitle]="'invoiceMatching.form.overrideModalTitle' | translate"
      [nzOkText]="'invoiceMatching.button.confirm' | translate"
      [nzCancelText]="'invoiceMatching.button.cancel' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="overrideForm.invalid"
      [nzOkDanger]="true"
      (nzOnOk)="submitOverride()"
      (nzOnCancel)="close()"
      data-testid="override-modal"
    >
      <ng-container *nzModalContent>
        <nz-alert
          nzType="warning"
          nzShowIcon
          [nzMessage]="'invoiceMatching.form.overrideWarning' | translate"
        />
        @if (forbidden()) {
          <nz-alert
            class="forbidden"
            nzType="error"
            nzShowIcon
            data-testid="override-forbidden"
            [nzMessage]="'invoiceMatching.message.overrideForbidden' | translate"
          />
        }
        <form nz-form nzLayout="vertical" [formGroup]="overrideForm">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="override-reason">{{
              'invoiceMatching.form.reason' | translate
            }}</nz-form-label>
            <nz-form-control
              [nzErrorTip]="'invoiceMatching.form.reasonMin' | translate: { min: minReasonLength }"
            >
              <textarea nz-input id="override-reason" rows="3" formControlName="reason"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
    }
    .lines {
      list-style: none;
      padding: 0;
    }
    .forbidden {
      margin-top: 12px;
    }
  `,
})
export class InvoiceMatchResolutionActionsComponent {
  protected readonly store = inject(InvoiceMatchingStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly run = input.required<InvoiceMatchRun>();
  /** Emits the run returned by the API (the new current run after a re-match). */
  readonly resolved = output<InvoiceMatchRun>();

  protected readonly minReasonLength = MIN_OVERRIDE_REASON_LENGTH;
  protected readonly reasonText = reasonKey;
  protected readonly dialog = signal<ResolutionDialog | null>(null);
  protected readonly forbidden = signal(false);
  protected readonly selectedLineIds = signal<string[]>([]);
  protected readonly blocking = computed(() => canResolve(this.run()));
  protected readonly lines = computed(() => blockingLines(this.run()));

  protected readonly creditForm = this.fb.group({
    reason: this.fb.control('', [Validators.required, trimmedMinLength(1)]),
    expected_credit_amount: this.fb.control<number | null>(null),
  });
  protected readonly rematchForm = this.fb.group({ reason: this.fb.control('') });
  protected readonly partialForm = this.fb.group({
    reason: this.fb.control('', [Validators.required, trimmedMinLength(1)]),
  });
  protected readonly overrideForm = this.fb.group({
    reason: this.fb.control('', [
      Validators.required,
      trimmedMinLength(MIN_OVERRIDE_REASON_LENGTH),
    ]),
  });

  open(dialog: ResolutionDialog): void {
    this.forbidden.set(false);
    this.selectedLineIds.set([]);
    this.creditForm.reset({ reason: '', expected_credit_amount: null });
    this.rematchForm.reset({ reason: '' });
    this.partialForm.reset({ reason: '' });
    this.overrideForm.reset({ reason: '' });
    this.dialog.set(dialog);
  }

  close(): void {
    this.dialog.set(null);
  }

  protected isSelected(lineId: string): boolean {
    return this.selectedLineIds().includes(lineId);
  }

  toggleLine(lineId: string, selected: boolean): void {
    this.selectedLineIds.update((ids) =>
      selected
        ? ids.includes(lineId)
          ? ids
          : [...ids, lineId]
        : ids.filter((id) => id !== lineId),
    );
  }

  async submitCreditNote(): Promise<void> {
    if (this.creditForm.invalid) {
      return;
    }
    const { reason, expected_credit_amount } = this.creditForm.getRawValue();
    const outcome = await this.store.requestCreditNote(this.run().id, {
      reason: reason.trim(),
      ...(expected_credit_amount !== null ? { expected_credit_amount } : {}),
    });
    this.finish(outcome, 'invoiceMatching.message.creditNoteRequested');
  }

  async submitRematch(): Promise<void> {
    const reason = this.rematchForm.getRawValue().reason.trim();
    const outcome = await this.store.rematch(this.run().id, reason ? { reason } : {});
    this.finish(outcome, 'invoiceMatching.message.rematched', true);
  }

  async submitPartial(): Promise<void> {
    const lineIds = this.selectedLineIds();
    if (this.partialForm.invalid || lineIds.length === 0) {
      this.message.warning(this.i18n.translate('invoiceMatching.message.partialNeedsLines'));
      return;
    }
    const outcome = await this.store.partialResolution(this.run().id, {
      reason: this.partialForm.getRawValue().reason.trim(),
      line_ids: [...lineIds],
    });
    this.finish(outcome, 'invoiceMatching.message.partiallyResolved');
  }

  async submitOverride(): Promise<void> {
    if (this.overrideForm.invalid) {
      return;
    }
    const outcome = await this.store.override(this.run().id, {
      reason: this.overrideForm.getRawValue().reason.trim(),
    });
    if (outcome.forbidden) {
      this.forbidden.set(true);
      this.message.error(this.i18n.translate('invoiceMatching.message.overrideForbidden'));
      return;
    }
    this.finish(outcome, 'invoiceMatching.message.overridden');
  }

  private finish(outcome: MatchingOutcome, successKey: string, withStatus = false): void {
    if (outcome.ok && outcome.result) {
      this.message.success(
        this.i18n.translate(
          successKey,
          withStatus
            ? { status: this.i18n.translate(`invoiceMatching.status.${outcome.result.status}`) }
            : undefined,
        ),
      );
      this.close();
      this.resolved.emit(outcome.result);
    } else {
      this.message.error(
        outcome.message || this.i18n.translate('invoiceMatching.message.genericError'),
      );
    }
  }
}
