import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GcPassageCounter } from '@core';
import { TranslatePipe } from '@shared';
import { counterPercent, counterStatus, passageLabel } from './green-care.util';

/**
 * Visual passage counter of a seasonal contract: a progress bar and the badge "Passage 8 of 16"; beyond the included passages the
 * badge turns red and reads "17 of 16 - extra to invoice".
 */
@Component({
  selector: 'app-green-care-passage-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzProgressModule, NzTagModule, TranslatePipe],
  styleUrl: './green-care.scss',
  template: `
    <div class="passage-counter" [class.over]="counter().is_over_included" data-test="passage-counter">
      <div class="passage-head">
        <nz-tag [nzColor]="counter().is_over_included ? 'red' : 'green'" data-test="passage-badge">
          {{ label().key | translate: label().params }}
        </nz-tag>
        @if (counter().is_over_included) {
          <span class="hint" data-test="passage-extra">{{ 'greenCare.passage.extraCount' | translate: { extra: counter().extra } }}</span>
        }
      </div>
      <nz-progress nzSize="small" [nzPercent]="percent()" [nzStatus]="status()" [nzShowInfo]="false"></nz-progress>
    </div>
  `,
})
export class GreenCarePassageCounterComponent {
  readonly counter = input.required<GcPassageCounter>();

  protected readonly label = computed(() => passageLabel(this.counter()));
  protected readonly percent = computed(() => counterPercent(this.counter()));
  protected readonly status = computed(() => counterStatus(this.counter()));
}
