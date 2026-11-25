import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { LiquidityPlanningStore } from './liquidity-planning.store';
import { capitalTone, dscrTone, pfnTone, tagColor } from './liquidity-planning.util';

type View = 'baseline' | 'scenario';

/** Crisis early-warning indicators (CO 725 / Art. 2086 c.c.) with the analytical DSCR breakdown for the auditors. */
@Component({
  selector: 'app-lp-indicators',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzSegmentedModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './liquidity-planning.scss',
  template: `
    @if (store.scenarioIndicators()) {
      <nz-segmented
        [nzOptions]="viewOptions()"
        [ngModel]="view()"
        (ngModelChange)="view.set($event)"
        data-testid="lp-indicators-view"
      />
    }

    @if (indicators(); as ind) {
      <div class="lp-indicator-grid">
        <nz-card [nzTitle]="'lp.dscr.title' | translate" data-testid="lp-dscr">
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'lp.dscr.value' | translate">
              <strong>{{ ind.dscr.value ?? ('lp.common.notAvailable' | translate) }}</strong>
              <nz-tag [nzColor]="color(dscrToneOf(ind.dscr.status))">
                {{ 'lp.dscr.status.' + ind.dscr.status | translate }}
              </nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.dscr.operatingCashFlow' | translate">
              {{ ind.dscr.operating_cash_flow | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.dscr.principal' | translate">
              {{ ind.dscr.debt_service.principal | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.dscr.interest' | translate">
              {{ ind.dscr.debt_service.interest | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.dscr.debtService' | translate">
              {{ ind.dscr.debt_service.total | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.dscr.thresholds' | translate">
              {{
                'lp.dscr.thresholdsValue'
                  | translate
                    : {
                        critical: ind.dscr.thresholds.critical,
                        warning: ind.dscr.thresholds.warning,
                      }
              }}
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>

        <nz-card [nzTitle]="'lp.capital.title' | translate" data-testid="lp-capital">
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'lp.capital.regimeLabel' | translate">
              {{ 'lp.capital.regime.' + ind.capital.regime | translate }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.capital.status.label' | translate">
              <nz-tag [nzColor]="color(capitalToneOf(ind.capital.status))">
                {{ 'lp.capital.status.' + ind.capital.status | translate }}
              </nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.capital.shareCapital' | translate">
              {{ ind.capital.share_capital | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.capital.halfCapital' | translate">
              {{ ind.capital.half_capital | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.capital.legalMinimum' | translate">
              {{ ind.capital.legal_minimum | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.capital.netEquity' | translate">
              {{ ind.capital.net_equity | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.capital.coverage' | translate">
              {{ ind.capital.coverage_percent ?? ('lp.common.notAvailable' | translate) }}
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>

        <nz-card [nzTitle]="'lp.pfn.title' | translate" data-testid="lp-pfn">
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'lp.pfn.financialDebt' | translate">
              {{ ind.pfn.financial_debt | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.pfn.cash' | translate">
              {{ ind.pfn.cash | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.pfn.pfn' | translate">
              {{ ind.pfn.pfn | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.pfn.ebitda' | translate">
              {{ ind.pfn.ebitda | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.pfn.ratio' | translate">
              {{ ind.pfn.pfn_ebitda ?? ('lp.common.notAvailable' | translate) }}
              <nz-tag [nzColor]="color(pfnToneOf(ind.pfn.status))">
                {{ 'lp.pfn.status.' + ind.pfn.status | translate }}
              </nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.pfn.maxRatio' | translate">
              {{ ind.pfn.max_ratio }}
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>

        <nz-card [nzTitle]="'lp.liquidity.title' | translate" data-testid="lp-liquidity">
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'lp.liquidity.minimum' | translate">
              {{ ind.liquidity.minimum_balance | money: store.currency() }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.liquidity.runway' | translate">
              @if (ind.liquidity.runway_days === null) {
                {{ 'lp.liquidity.noRunwayLimit' | translate }}
              } @else {
                {{ 'lp.liquidity.runwayDays' | translate: { days: ind.liquidity.runway_days } }}
              }
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.liquidity.firstNegative' | translate">
              {{ ind.liquidity.first_negative_date ?? ('lp.common.none' | translate) }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'lp.liquidity.status.label' | translate">
              <nz-tag
                [nzColor]="
                  ind.liquidity.status === 'ok'
                    ? 'success'
                    : ind.liquidity.status === 'watch'
                      ? 'warning'
                      : 'error'
                "
              >
                {{ 'lp.liquidity.status.' + ind.liquidity.status | translate }}
              </nz-tag>
            </nz-descriptions-item>
          </nz-descriptions>
        </nz-card>
      </div>

      <nz-card class="lp-lines" [nzTitle]="'lp.dscr.breakdownTitle' | translate">
        <nz-table
          #lines
          nzSize="small"
          [nzData]="ind.dscr.lines"
          [nzPageSize]="25"
          [nzShowPagination]="ind.dscr.lines.length > 25"
          data-testid="lp-dscr-lines"
        >
          <thead>
            <tr>
              <th>{{ 'lp.dscr.col.date' | translate }}</th>
              <th>{{ 'lp.dscr.col.kind' | translate }}</th>
              <th>{{ 'lp.dscr.col.category' | translate }}</th>
              <th>{{ 'lp.dscr.col.tier' | translate }}</th>
              <th class="lp-num">{{ 'lp.dscr.col.amount' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of lines.data; track $index) {
              <tr>
                <td>{{ line.date }}</td>
                <td>{{ 'lp.dscr.kind.' + line.kind | translate }}</td>
                <td>
                  {{
                    line.label_key ? (line.label_key | translate) : (line.label ?? line.category)
                  }}
                </td>
                <td>{{ 'lp.tier.' + line.tier | translate }}</td>
                <td class="lp-num">{{ line.amount | money: store.currency() }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else {
      <nz-empty [nzNotFoundContent]="'lp.chart.empty' | translate" />
    }
  `,
})
export class LpIndicatorsComponent {
  protected readonly store = inject(LiquidityPlanningStore);
  protected readonly view = signal<View>('baseline');

  protected readonly dscrToneOf = dscrTone;
  protected readonly pfnToneOf = pfnTone;
  protected readonly capitalToneOf = capitalTone;
  protected readonly color = tagColor;

  private readonly i18n = inject(TranslateService);

  protected readonly viewOptions = computed(() => [
    { label: this.i18n.translate('lp.chart.baseline'), value: 'baseline' },
    { label: this.i18n.translate('lp.chart.scenario'), value: 'scenario' },
  ]);

  protected readonly indicators = computed(() =>
    this.view() === 'scenario'
      ? (this.store.scenarioIndicators() ?? this.store.baselineIndicators())
      : this.store.baselineIndicators(),
  );
}
