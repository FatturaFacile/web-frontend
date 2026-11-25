import { Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TranslatePipe } from '@shared';

/** A dialog that asks for a reason (and an amount when asked to) before a write that must be justified in the audit trail. */
@Component({
  selector: 'app-intercompany-reason-dialog',
  imports: [FormsModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="titleKey() | translate"
      [nzOkText]="'intercompany.common.confirm' | translate"
      [nzCancelText]="'intercompany.common.cancel' | translate"
      [nzOkDisabled]="!valid()"
      (nzOnOk)="confirm()"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        <label for="ic-reason">{{ fieldLabelKey() | translate }}</label>
        <textarea id="ic-reason" nz-input rows="3" [ngModel]="reason()" (ngModelChange)="reason.set($event)"></textarea>
        @if (withAmount()) {
          <label for="ic-reason-amount">{{ 'intercompany.reconciliation.adjustmentAmount' | translate }}</label>
          <input id="ic-reason-amount" nz-input inputmode="decimal" [ngModel]="amount()" (ngModelChange)="amount.set($event)" />
        }
      </ng-container>
    </nz-modal>
  `,
})
export class IntercompanyReasonDialogComponent {
  readonly open = model(false);
  readonly titleKey = input.required<string>();
  readonly withAmount = input(false);
  readonly minLength = input(3);
  /** Label of the text field: the reason by default, the counterpart document for a manual match. */
  readonly fieldLabelKey = input('intercompany.common.reason');
  readonly confirmed = output<{ reason: string; amount: string }>();

  protected readonly reason = signal('');
  protected readonly amount = signal('');

  protected readonly valid = computed(() => {
    const amountOk = !this.withAmount() || /^-?\d+(\.\d{1,4})?$/.test(this.amount().trim());
    return this.reason().trim().length >= this.minLength() && amountOk;
  });

  protected confirm(): void {
    if (this.valid()) {
      this.confirmed.emit({ reason: this.reason().trim(), amount: this.amount().trim() });
      this.close();
    }
  }

  protected close(): void {
    this.open.set(false);
    this.reason.set('');
    this.amount.set('');
  }
}
