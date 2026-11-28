import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { WrThreshold } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { progressStatus, thresholdBars, thresholdKeyOf } from './withholding-recipients.util';

/**
 * Progress bars of the statutory thresholds of a recipient (occasional work INPS limit, amateur sports exemption and IRPEF
 * limit on one bar with two tiers, Swiss AVS de minimis, Enasarco ceiling). The bar turns orange near the limit and red once
 * it is reached. Used by the dashboard (compact), the profile drawer and the simulator.
 */
@Component({
  selector: 'app-wr-threshold-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, NzProgressModule, TranslatePipe],
  template: `
    @for (bar of bars(); track bar.key) {
      <div class="bar" [class.compact]="compact()">
        <div class="caption">
          <span class="label">{{ labelOf(bar.key) | translate }}</span>
          <span class="amounts">
            {{ bar.current | money: currency() }} / {{ bar.limit | money: currency() }}
          </span>
        </div>
        <nz-progress
          [nzPercent]="clamp(bar.percent)"
          [nzStatus]="status(bar.percent)"
          [nzSize]="compact() ? 'small' : 'default'"
          [nzShowInfo]="!compact()"
        ></nz-progress>
        @if (bar.tier; as tier) {
          <div class="caption tier">
            <span class="label">{{ labelOf(tier.key) | translate }}</span>
            <span class="amounts">
              {{ tier.current | money: currency() }} / {{ tier.limit | money: currency() }}
            </span>
          </div>
          <nz-progress
            [nzPercent]="clamp(tier.percent)"
            [nzStatus]="status(tier.percent)"
            [nzSize]="compact() ? 'small' : 'default'"
            [nzShowInfo]="!compact()"
          ></nz-progress>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .bar + .bar {
      margin-top: 8px;
    }

    .caption {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
    }

    .compact .caption {
      font-size: 11px;
    }

    .tier {
      margin-top: 4px;
    }

    .amounts {
      color: var(--ant-text-color-secondary, #595959);
      white-space: nowrap;
    }
  `,
})
export class ThresholdBarsComponent {
  readonly thresholds = input.required<readonly WrThreshold[]>();
  readonly currency = input<string>('EUR');
  readonly compact = input<boolean>(false);

  readonly bars = computed(() => thresholdBars(this.thresholds()));

  readonly labelOf = thresholdKeyOf;

  status(percent: number) {
    return progressStatus(percent);
  }

  clamp(percent: number): number {
    return Math.max(0, Math.min(100, percent));
  }
}
