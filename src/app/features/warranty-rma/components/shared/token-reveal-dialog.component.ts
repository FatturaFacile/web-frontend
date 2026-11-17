import { Clipboard } from '@angular/cdk/clipboard';
import { Component, inject, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TranslatePipe } from '@shared';
import { RmaNotifier } from '../../state/action-result';
import { TokenReveal } from '../../state/rma-detail.store';

/**
 * Shows a raw link/token returned by the API exactly once. Nothing is stored: the parent drops the
 * value when the dialog closes.
 */
@Component({
  selector: 'app-token-reveal-dialog',
  imports: [NzModalModule, NzAlertModule, NzButtonModule, NzInputModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="!!reveal()"
      [nzTitle]="
        (reveal()?.kind === 'tracking' ? 'RMA.REVEAL.TRACKING_TITLE' : 'RMA.REVEAL.ESTIMATE_TITLE')
          | translate
      "
      [nzFooter]="footer"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <nz-alert nzType="warning" nzShowIcon [nzMessage]="'RMA.REVEAL.ONCE_WARNING' | translate" />
        @if (reveal()?.url; as url) {
          <label class="reveal-label" for="reveal-url">{{ 'RMA.REVEAL.LINK' | translate }}</label>
          <div class="reveal-row">
            <input nz-input id="reveal-url" readonly [value]="url" />
            <button nz-button type="button" (click)="copy(url)">
              <i class="fa-solid fa-copy" aria-hidden="true"></i>&nbsp;{{
                'RMA.REVEAL.COPY' | translate
              }}
            </button>
          </div>
        }
        @if (reveal()?.token; as token) {
          <label class="reveal-label" for="reveal-token">{{
            'RMA.REVEAL.TOKEN' | translate
          }}</label>
          <div class="reveal-row">
            <input nz-input id="reveal-token" readonly [value]="token" />
            <button nz-button type="button" (click)="copy(token)">
              <i class="fa-solid fa-copy" aria-hidden="true"></i>&nbsp;{{
                'RMA.REVEAL.COPY' | translate
              }}
            </button>
          </div>
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button nzType="primary" type="button" (click)="closed.emit()">
          {{ 'RMA.REVEAL.DONE' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .reveal-label {
      display: block;
      margin-top: 16px;
      font-weight: 600;
    }
    .reveal-row {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
  `,
})
export class TokenRevealDialogComponent {
  private readonly clipboard = inject(Clipboard);
  private readonly notifier = inject(RmaNotifier);

  readonly reveal = input<TokenReveal | null>(null);
  readonly closed = output<void>();

  copy(value: string): void {
    if (this.clipboard.copy(value)) {
      this.notifier.success('RMA.REVEAL.COPIED');
    }
  }
}
