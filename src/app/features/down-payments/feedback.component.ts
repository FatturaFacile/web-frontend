import { Component, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { TranslatePipe } from '@shared';
import { DpOutcome } from './down-payments.util';

/** The refusal of the API: the translated text of its `code` with the parameters of the problem, and the detail it sent. */
@Component({
  selector: 'app-dp-feedback',
  imports: [NzAlertModule, TranslatePipe],
  template: `
    @if (outcome(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        data-test="feedback"
        [nzMessage]="failure.errorKey ?? 'down_payments.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="dismissed.emit()"
      ></nz-alert>
    }
  `,
  styles: `
    .feedback {
      display: block;
      margin-bottom: 12px;
    }
  `,
})
export class DpFeedbackComponent {
  readonly outcome = input<DpOutcome | null>(null);
  readonly dismissed = output<void>();
}
