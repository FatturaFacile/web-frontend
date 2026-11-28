import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { WrInlNotification, WrRegime } from '@core';
import { TranslatePipe } from '@shared';
import { inlCoverage, inlCoverageKey, isInlBlocking } from './withholding-recipients.util';

/**
 * Pre-payment gate of the occasional workers: tells whether a preventive INL communication, sent before the work started,
 * covers the date of the service. A missing, late or expired communication blocks the posting (the API enforces the same
 * rule). Nothing is shown for the regimes that do not need the communication.
 */
@Component({
  selector: 'app-wr-inl-gate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzAlertModule, TranslatePipe],
  template: `
    @switch (coverage()) {
      @case ('covered') {
        <nz-alert
          nzType="success"
          nzShowIcon
          [nzMessage]="'withholdingRecipients.inl.gateCovered' | translate"
        ></nz-alert>
      }
      @case ('not_required') {}
      @default {
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="'withholdingRecipients.inl.gateBlocked' | translate"
          [nzDescription]="reasonKey() | translate"
        ></nz-alert>
      }
    }
  `,
})
export class InlGateComponent {
  readonly regime = input<WrRegime | null>(null);
  readonly notifications = input<readonly WrInlNotification[]>([]);
  /** The date of the service (or of the payment when the service date is not known). */
  readonly date = input.required<string>();

  readonly coverage = computed(() => inlCoverage(this.regime(), this.notifications(), this.date()));
  readonly blocking = computed(() => isInlBlocking(this.coverage()));
  readonly reasonKey = computed(() => inlCoverageKey(this.coverage()));
}
