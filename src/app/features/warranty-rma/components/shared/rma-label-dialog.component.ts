import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { RmaLabel } from '@core';
import { code128BGeometry, TranslatePipe } from '@shared';
import { RmaNotifier } from '../../state/action-result';

const PRINT_CLASS = 'rma-label-printing';

/** Shipping label with a Code 128 barcode; the raw tracking link is only present right after issue. */
@Component({
  selector: 'app-rma-label-dialog',
  imports: [NzModalModule, NzAlertModule, NzButtonModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="!!label()"
      [nzTitle]="'RMA.LABEL.TITLE' | translate"
      [nzFooter]="footer"
      [nzWidth]="560"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        @if (label(); as l) {
          <div class="rma-label">
            <p class="rma-label-number">{{ l.rma_number }}</p>
            @if (barcode(); as b) {
              <svg
                class="rma-label-barcode"
                role="img"
                [attr.aria-label]="
                  'RMA.LABEL.BARCODE_ALT' | translate: { value: l.barcode_payload }
                "
                [attr.viewBox]="'0 0 ' + b.width + ' 60'"
                preserveAspectRatio="none"
              >
                <!-- Barcode: black on white in both themes so it stays scannable -->
                <rect x="0" y="0" [attr.width]="b.width" height="60" fill="#fff" />
                @for (bar of b.bars; track $index) {
                  <rect [attr.x]="bar.x" y="0" [attr.width]="bar.width" height="60" fill="#000" />
                }
              </svg>
              <p class="rma-label-payload">{{ l.barcode_payload }}</p>
            }
            <dl class="rma-label-fields">
              <dt>{{ 'RMA.FIELDS.SERIAL' | translate }}</dt>
              <dd>{{ l.serial_number }}</dd>
              @if (l.product_name) {
                <dt>{{ 'RMA.FIELDS.PRODUCT' | translate }}</dt>
                <dd>{{ l.product_name }}</dd>
              }
              @if (l.customer_name) {
                <dt>{{ 'RMA.FIELDS.CUSTOMER' | translate }}</dt>
                <dd>{{ l.customer_name }}</dd>
              }
              @if (l.return_address) {
                <dt>{{ 'RMA.LABEL.RETURN_ADDRESS' | translate }}</dt>
                <dd class="rma-label-address">{{ l.return_address }}</dd>
              }
            </dl>
          </div>
          @if (l.tracking_url || l.tracking_token) {
            <div class="no-print rma-label-tracking">
              <nz-alert
                nzType="warning"
                nzShowIcon
                [nzMessage]="'RMA.REVEAL.ONCE_WARNING' | translate"
              />
              @if (l.tracking_url) {
                <p>
                  <strong>{{ 'RMA.LABEL.TRACKING_URL' | translate }}:</strong>
                  <code class="rma-label-code">{{ l.tracking_url }}</code>
                  <button nz-button nzType="link" type="button" (click)="copy(l.tracking_url)">
                    <i class="fa-solid fa-copy" aria-hidden="true"></i>&nbsp;{{
                      'RMA.REVEAL.COPY' | translate
                    }}
                  </button>
                </p>
              }
              @if (l.tracking_token) {
                <p>
                  <strong>{{ 'RMA.REVEAL.TOKEN' | translate }}:</strong>
                  <code class="rma-label-code">{{ l.tracking_token }}</code>
                </p>
              }
            </div>
          }
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" (click)="closed.emit()">
          {{ 'COMMON.CLOSE' | translate }}
        </button>
        <button nz-button nzType="primary" type="button" (click)="print()">
          <i class="fa-solid fa-print" aria-hidden="true"></i>&nbsp;{{
            'RMA.LABEL.PRINT' | translate
          }}
        </button>
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .rma-label-number {
      font-size: 22px;
      font-weight: 700;
      text-align: center;
      margin: 0 0 8px;
    }
    .rma-label-barcode {
      display: block;
      width: 100%;
      height: 72px;
    }
    .rma-label-payload {
      text-align: center;
      font-family: monospace;
      margin: 4px 0 12px;
    }
    .rma-label-fields {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 12px;
      margin: 0;
    }
    .rma-label-fields dt {
      font-weight: 600;
    }
    .rma-label-fields dd {
      margin: 0;
    }
    .rma-label-address {
      white-space: pre-line;
    }
    .rma-label-tracking {
      margin-top: 16px;
    }
    .rma-label-code {
      word-break: break-all;
    }
  `,
})
export class RmaLabelDialogComponent {
  private readonly clipboard = inject(Clipboard);
  private readonly notifier = inject(RmaNotifier);
  private readonly document = inject(DOCUMENT);

  readonly label = input<RmaLabel | null>(null);
  readonly closed = output<void>();

  readonly barcode = computed(() => {
    const payload = this.label()?.barcode_payload;
    if (!payload) {
      return null;
    }
    try {
      return code128BGeometry(payload);
    } catch {
      return null;
    }
  });

  copy(value: string): void {
    if (this.clipboard.copy(value)) {
      this.notifier.success('RMA.REVEAL.COPIED');
    }
  }

  /** Prints only the label (see the `rma-label-printing` print rules in styles.scss). */
  print(): void {
    const body = this.document.body;
    const view = this.document.defaultView;
    if (!view) {
      return;
    }
    body.classList.add(PRINT_CLASS);
    try {
      view.print();
    } finally {
      body.classList.remove(PRINT_CLASS);
    }
  }
}
