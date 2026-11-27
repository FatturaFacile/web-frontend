import { Component, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { DpJurisdiction } from '@core';
import { TranslatePipe } from '@shared';

/**
 * The tax treatment of the advances of the jurisdiction: in Italy the advance invoice is due when the payment is received (Art. 15
 * DPR 633/72) and a receipt out of VAT carries the stamp duty above EUR 77.47; in Switzerland the deposit is out of scope (Art. 158 CO).
 */
@Component({
  selector: 'app-dp-jurisdiction-notice',
  imports: [NzAlertModule, TranslatePipe],
  template: `
    @if (jurisdiction() === 'IT') {
      <nz-alert
        class="notice"
        nzType="info"
        nzShowIcon
        data-test="notice-it"
        [nzMessage]="'down_payments.notice.itTitle' | translate"
        [nzDescription]="'down_payments.notice.itBody' | translate"
      ></nz-alert>
    } @else if (jurisdiction() === 'CH') {
      <nz-alert
        class="notice"
        nzType="info"
        nzShowIcon
        data-test="notice-ch"
        [nzMessage]="'down_payments.notice.chTitle' | translate"
        [nzDescription]="'down_payments.notice.chBody' | translate"
      ></nz-alert>
    }
  `,
  styles: `
    .notice {
      display: block;
      margin-bottom: 12px;
    }
  `,
})
export class DpJurisdictionNoticeComponent {
  readonly jurisdiction = input<DpJurisdiction | null>(null);
}
