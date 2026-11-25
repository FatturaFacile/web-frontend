import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { LpGranularity, LpHorizonDays, TranslateService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { LpChartComponent } from './lp-chart.component';
import { LiquidityPlanningStore } from './liquidity-planning.store';
import { buildCashOption, LP_HORIZONS, num } from './liquidity-planning.util';

/** Daily and weekly cash curve: horizon, granularity and reliability-tier filters, baseline versus what-if overlay. */
@Component({
  selector: 'app-lp-cash-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    LpChartComponent,
    NzEmptyModule,
    NzSegmentedModule,
    NzSwitchModule,
    NzTagModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    <div class="lp-toolbar">
      <nz-segmented
        [nzOptions]="horizonOptions()"
        [ngModel]="store.horizon()"
        (ngModelChange)="store.setHorizon($event)"
        data-testid="lp-horizon"
      />

      <nz-segmented
        [nzOptions]="granularityOptions()"
        [ngModel]="store.granularity()"
        (ngModelChange)="store.setGranularity($event)"
        data-testid="lp-granularity"
      />

      <span class="lp-toggle">
        <nz-switch
          [ngModel]="store.showTiers()"
          (ngModelChange)="store.setShowTiers($event)"
          data-testid="lp-tiers-switch"
        />
        {{ 'lp.chart.tiers' | translate }}
      </span>
    </div>

    @if (option(); as chart) {
      <app-lp-chart [option]="chart" [label]="'lp.chart.aria' | translate" />
      @if (store.overview(); as overview) {
        @if (overview.baseline.negative_balance; as negative) {
          <nz-tag nzColor="error" data-testid="lp-negative">
            {{ 'lp.chart.negativeFrom' | translate: { date: negative.first_date } }}
            ({{ negative.min_balance | money: overview.currency }})
          </nz-tag>
        }
        <p class="lp-note">
          {{ 'lp.chart.tierHint' | translate }}
        </p>
      }
    } @else {
      <nz-empty [nzNotFoundContent]="'lp.chart.empty' | translate" />
    }
  `,
})
export class LpCashChartComponent {
  protected readonly store = inject(LiquidityPlanningStore);
  private readonly i18n = inject(TranslateService);
  protected readonly horizonOptions = computed(() =>
    LP_HORIZONS.map((days: LpHorizonDays) => ({
      value: days,
      label: this.i18n.translate('lp.chart.days', { days }),
    })),
  );
  protected readonly granularityOptions = computed(() => [
    { value: 'daily', label: this.i18n.translate('lp.chart.daily') },
    { value: 'weekly', label: this.i18n.translate('lp.chart.weekly') },
  ]);

  protected readonly option = computed(() => {
    const overview = this.store.overview();

    if (overview === null) {
      return null;
    }

    const granularity: LpGranularity = this.store.granularity();

    return buildCashOption({
      baseline: overview.baseline,
      scenario: overview.scenario,
      asOf: overview.as_of,
      horizon: this.store.horizon(),
      granularity,
      showTiers: this.store.showTiers(),
      minimumBalance: num(this.store.settings()?.minimum_liquidity),
      currency: overview.currency,
      labels: {
        baseline: this.i18n.translate('lp.chart.baseline'),
        scenario: this.i18n.translate('lp.chart.scenario'),
        minimum: this.i18n.translate('lp.chart.minimum'),
        tiers: {
          certain: this.i18n.translate('lp.tier.certain'),
          probable: this.i18n.translate('lp.tier.probable'),
          estimated: this.i18n.translate('lp.tier.estimated'),
        },
      },
    });
  });
}
