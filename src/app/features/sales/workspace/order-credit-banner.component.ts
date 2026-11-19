import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TranslatePipe } from '@shared';
import { creditLevel } from './sales-workspace.logic';
import { CreditExposure } from './sales-workspace.models';

/** Minimum length of the justification of a credit release (the API requires 5 characters). */
export const MIN_RELEASE_NOTES = 5;

/**
 * Credit position of an order: a warning from 90% of the limit, and for an order blocked for credit a banner with the
 * exposure figures and, for the credit managers, the "Authorize Credit Release" button opening a justification modal.
 */
@Component({
  selector: 'app-order-credit-banner',
  imports: [
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    TranslatePipe,
  ],
  template: `
    @if (level() !== 'ok') {
      <nz-alert
        class="banner"
        [nzType]="level() === 'blocked' ? 'error' : 'warning'"
        nzShowIcon
        [nzMessage]="
          (level() === 'blocked' ? 'SWK.CREDIT.BLOCKED_TITLE' : 'SWK.CREDIT.WARNING_TITLE')
            | translate
        "
        [nzDescription]="figures"
      />
      <ng-template #figures>
        <ul class="figures">
          <li>
            {{ 'SWK.CREDIT.LIMIT' | translate }}: {{ exposure()?.credit_limit | number: '1.2-2' }}
          </li>
          <li>
            {{ 'SWK.CREDIT.OPEN_AR' | translate }}:
            {{ exposure()?.open_receivables | number: '1.2-2' }}
          </li>
          <li>
            {{ 'SWK.CREDIT.COMMITTED' | translate }}:
            {{ exposure()?.committed_orders | number: '1.2-2' }}
          </li>
          <li>
            {{ 'SWK.CREDIT.OVERDUE' | translate }}:
            {{ exposure()?.overdue_amount | number: '1.2-2' }}
          </li>
          <li>
            {{ 'SWK.CREDIT.ORDER' | translate }}: {{ exposure()?.order_total | number: '1.2-2' }}
          </li>
          <li>
            <strong
              >{{ 'SWK.CREDIT.TOTAL_EXPOSURE' | translate }}:
              {{ exposure()?.total_exposure | number: '1.2-2' }}</strong
            >
          </li>
        </ul>
        @if (blocked() && canRelease()) {
          <button nz-button nzType="primary" nzDanger type="button" (click)="modalOpen.set(true)">
            {{ 'SWK.CREDIT.AUTHORIZE' | translate }}
          </button>
        }
      </ng-template>
    }

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'SWK.CREDIT.AUTHORIZE' | translate"
      [nzOkText]="'SWK.CREDIT.AUTHORIZE' | translate"
      [nzOkDisabled]="!notesValid()"
      [nzOkLoading]="working()"
      (nzOnOk)="confirm()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <label for="credit-release-notes">{{ 'SWK.CREDIT.JUSTIFICATION' | translate }}</label>
        <textarea
          id="credit-release-notes"
          nz-input
          rows="4"
          [ngModel]="notes()"
          (ngModelChange)="notes.set($event)"
        ></textarea>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .banner {
      display: block;
      margin-bottom: 16px;
    }
    .figures {
      margin: 0 0 12px;
      padding-left: 18px;
    }
  `,
})
export class OrderCreditBannerComponent {
  readonly exposure = input<CreditExposure | null | undefined>(null);
  /** The order is blocked for credit approval (status on hold). */
  readonly blocked = input(false);
  /** The user holds the credit manager permission. */
  readonly canRelease = input(false);
  readonly working = input(false);
  readonly release = output<string>();

  protected readonly modalOpen = signal(false);
  protected readonly notes = signal('');
  protected readonly level = computed(() =>
    this.blocked() ? 'blocked' : creditLevel(this.exposure()),
  );
  protected readonly notesValid = computed(() => this.notes().trim().length >= MIN_RELEASE_NOTES);

  protected confirm(): void {
    if (!this.notesValid()) {
      return;
    }
    this.release.emit(this.notes().trim());
    this.modalOpen.set(false);
    this.notes.set('');
  }
}
