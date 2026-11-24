import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { TransferStatus } from '@core';
import { TranslatePipe } from '@shared';
import { TRACKER_STEPS, TrackerStep, trackerState } from '../../logistics.rules';
import { trackerStepKey } from '../../logistics.ui';

/** Draft -> Approved -> Shipped -> Received -> Closed tracker, with the partial and discrepancy states called out. */
@Component({
  selector: 'app-transfer-tracker',
  imports: [NzStepsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-steps
      nzSize="small"
      nzLabelPlacement="vertical"
      [nzCurrent]="state().current"
      [nzStatus]="state().status"
      [attr.aria-label]="'LOGISTICS.TRACKER.LABEL' | translate"
    >
      @for (step of steps; track step) {
        <nz-step
          [nzTitle]="stepKey(step) | translate"
          [nzDescription]="description(step) ? (description(step)! | translate) : ''"
        />
      }
    </nz-steps>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 16px;
    }
  `,
})
export class TransferTrackerComponent {
  readonly status = input.required<TransferStatus>();

  protected readonly steps = TRACKER_STEPS;
  protected readonly stepKey = trackerStepKey;
  protected readonly state = computed(() => trackerState(this.status()));

  /** Sub-state shown under the step it belongs to. */
  protected description(step: TrackerStep): string | null {
    const state = this.state();
    if (state.cancelled && step === 'draft') return 'LOGISTICS.TRACKER.CANCELLED';
    if (step !== 'received') return null;
    if (state.partial) return 'LOGISTICS.TRACKER.PARTIAL';
    if (this.status() === 'discrepancy_pending') return 'LOGISTICS.TRACKER.DISCREPANCY';
    return null;
  }
}
