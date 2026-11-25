import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MoneyPipe, TranslatePipe } from '@shared';
import { LiquidityPlanningStore } from './liquidity-planning.store';
import { capitalTone, dscrTone, isBelow, pfnTone, tagColor } from './liquidity-planning.util';

/** Executive header: alert banner, 30/60/90/180-day snapshots, DSCR, PFN, PFN/EBITDA and the capital status. */
@Component({
  selector: 'app-lp-kpi-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzStatisticModule,
    NzTagModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    @if (store.activeAlerts().length > 0) {
      <nz-alert
        class="lp-banner"
        data-testid="lp-banner"
        nzShowIcon
        [nzType]="store.criticalAlerts().length > 0 ? 'error' : 'warning'"
        [nzMessage]="'lp.banner.title' | translate: { count: store.activeAlerts().length }"
        [nzDescription]="'lp.banner.description' | translate"
        [nzAction]="openAlertsAction"
      />
      <ng-template #openAlertsAction>
        <button nz-button nzSize="small" (click)="showAlerts.emit()">
          {{ 'lp.banner.open' | translate }}
        </button>
      </ng-template>
    }

    @if (store.overview(); as overview) {
      <div class="lp-kpi-grid" data-testid="lp-kpis">
        @for (horizon of overview.horizons; track horizon.days) {
          <nz-card class="lp-kpi" [nzBordered]="true">
            <nz-statistic
              [nzTitle]="'lp.kpi.horizon' | translate: { days: horizon.days }"
              [nzValue]="horizon.baseline.closing_balance | money: overview.currency"
            />
            @if (horizon.scenario; as scenario) {
              <div class="lp-kpi-sub lp-scenario">
                {{ 'lp.kpi.scenario' | translate }}:
                {{ scenario.closing_balance | money: overview.currency }}
              </div>
            }
            <div class="lp-kpi-sub">
              {{ 'lp.kpi.lowest' | translate }}:
              {{ horizon.baseline.min_balance | money: overview.currency }}
              @if (below(horizon.baseline.min_balance)) {
                <nz-tag nzColor="error">{{ 'lp.kpi.belowMinimum' | translate }}</nz-tag>
              }
            </div>
          </nz-card>
        }

        @if (store.baselineIndicators(); as indicators) {
          <nz-card class="lp-kpi" data-testid="lp-kpi-dscr">
            <nz-statistic
              [nzTitle]="'lp.kpi.dscr' | translate"
              [nzValue]="indicators.dscr.value ?? ('lp.common.notAvailable' | translate)"
            />
            <nz-tag [nzColor]="color(dscrToneOf(indicators.dscr.status))">
              {{ 'lp.dscr.status.' + indicators.dscr.status | translate }}
            </nz-tag>
            @if (store.scenarioIndicators(); as simulated) {
              <div class="lp-kpi-sub lp-scenario">
                {{ 'lp.kpi.scenario' | translate }}:
                {{ simulated.dscr.value ?? ('lp.common.notAvailable' | translate) }}
              </div>
            }
          </nz-card>

          <nz-card class="lp-kpi" data-testid="lp-kpi-pfn">
            <nz-statistic
              [nzTitle]="'lp.kpi.pfn' | translate"
              [nzValue]="indicators.pfn.pfn | money: overview.currency"
            />
            <div class="lp-kpi-sub">
              {{ 'lp.kpi.pfnEbitda' | translate }}:
              {{ indicators.pfn.pfn_ebitda ?? ('lp.common.notAvailable' | translate) }}
              <nz-tag [nzColor]="color(pfnToneOf(indicators.pfn.status))">
                {{ 'lp.pfn.status.' + indicators.pfn.status | translate }}
              </nz-tag>
            </div>
          </nz-card>

          <nz-card class="lp-kpi" data-testid="lp-kpi-capital">
            <nz-statistic
              [nzTitle]="'lp.kpi.capital' | translate"
              [nzValue]="indicators.capital.net_equity | money: overview.currency"
            />
            <div class="lp-kpi-sub">
              {{ 'lp.capital.regime.' + indicators.capital.regime | translate }}
            </div>
            <nz-tag [nzColor]="color(capitalToneOf(indicators.capital.status))">
              {{ 'lp.capital.status.' + indicators.capital.status | translate }}
            </nz-tag>
          </nz-card>
        }
      </div>
    }
  `,
})
export class LpKpiHeaderComponent {
  protected readonly store = inject(LiquidityPlanningStore);
  readonly showAlerts = output<void>();

  protected readonly dscrToneOf = dscrTone;
  protected readonly pfnToneOf = pfnTone;
  protected readonly capitalToneOf = capitalTone;
  protected readonly color = tagColor;

  protected below(balance: string): boolean {
    const minimum = this.store.settings()?.minimum_liquidity;

    return minimum !== undefined && isBelow(balance, minimum);
  }
}
