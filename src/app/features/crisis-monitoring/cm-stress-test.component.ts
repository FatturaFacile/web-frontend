import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CrisisApproach,
  CrisisHorizon,
  CrisisStatus,
  CrisisStressInput,
  CrisisStressLite,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { CrisisMonitoringStore } from './crisis-monitoring.store';
import {
  CRISIS_APPROACHES,
  CRISIS_HORIZONS,
  formatRatio,
  formatSigned,
  num,
  STRESS_SPECS,
  StressSpec,
  statusTone,
} from './crisis-monitoring.util';

interface DscrRow {
  approach: CrisisApproach;
  horizon: CrisisHorizon;
  deltaKey: 'dscr_treasury_m6' | 'dscr_treasury_m12' | 'dscr_operating_m6' | 'dscr_operating_m12';
}

const DSCR_ROWS: readonly DscrRow[] = CRISIS_APPROACHES.flatMap((approach) =>
  CRISIS_HORIZONS.map((horizon): DscrRow => ({
    approach,
    horizon,
    deltaKey: `dscr_${approach}_${horizon}` as DscrRow['deltaKey'],
  })),
);

/** Stress test simulator: levers (slider and number input), debounced run and the baseline versus stressed comparison. */
@Component({
  selector: 'app-cm-stress-test',
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzSliderModule,
    NzSpinModule,
    NzTagModule,
  ],
  styleUrl: './crisis-monitoring.scss',
  template: `
    <div class="cm-stress-grid">
      <nz-card [nzTitle]="'crisis.stress.levers' | translate" data-testid="cm-stress-levers">
        @for (spec of specs; track spec.key) {
          <div class="cm-lever">
            <label [for]="'cm-stress-' + spec.key">
              {{ 'crisis.stress.lever.' + spec.key | translate }}
              <span class="cm-note">({{ 'crisis.stress.unit.' + spec.unit | translate }})</span>
            </label>
            <div class="cm-lever-controls">
              @if (spec.unit !== 'amount') {
                <nz-slider
                  class="cm-lever-slider"
                  [nzMin]="spec.min"
                  [nzMax]="spec.max"
                  [nzStep]="spec.step"
                  [ngModel]="value(spec)"
                  (ngModelChange)="set(spec, $event)"
                />
              }
              <nz-input-number
                [nzId]="'cm-stress-' + spec.key"
                [nzMin]="spec.min"
                [nzMax]="spec.max"
                [nzStep]="spec.step"
                [ngModel]="value(spec)"
                (ngModelChange)="set(spec, $event)"
              />
            </div>
          </div>
        }
        <div class="cm-actions">
          <button nz-button data-testid="cm-stress-reset" (click)="store.resetStress()">
            {{ 'crisis.stress.reset' | translate }}
          </button>
        </div>
        <p class="cm-note">{{ 'crisis.stress.hint' | translate }}</p>
      </nz-card>

      <nz-card [nzTitle]="'crisis.stress.compare' | translate" data-testid="cm-stress-result">
        <nz-spin [nzSpinning]="store.stressRunning()">
          @if (store.stressError(); as error) {
            <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate" />
          }
          @if (store.stressResult(); as result) {
            <table class="cm-compare">
              <thead>
                <tr>
                  <th>{{ 'crisis.stress.col.metric' | translate }}</th>
                  <th class="cm-num">{{ 'crisis.stress.col.baseline' | translate }}</th>
                  <th class="cm-num">{{ 'crisis.stress.col.stressed' | translate }}</th>
                  <th class="cm-num">{{ 'crisis.stress.col.delta' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of dscrRows; track row.deltaKey) {
                  <tr [attr.data-testid]="'cm-stress-' + row.deltaKey">
                    <td>
                      {{ 'crisis.dscr.approach.' + row.approach | translate }} /
                      {{ 'crisis.dscr.horizon.' + row.horizon | translate }}
                    </td>
                    <td class="cm-num">{{ dscrText(result.baseline, row) }}</td>
                    <td class="cm-num">
                      <nz-tag
                        [nzColor]="tone(result.stressed.dscr[row.approach][row.horizon].status)"
                      >
                        {{ dscrText(result.stressed, row) }}
                      </nz-tag>
                    </td>
                    <td class="cm-num" [class]="deltaClass(result.deltas[row.deltaKey])">
                      {{ signed(result.deltas[row.deltaKey]) }}
                    </td>
                  </tr>
                }
                <tr>
                  <td>{{ 'crisis.stress.minCash' | translate }}</td>
                  <td class="cm-num">
                    {{ result.baseline.liquidity.min_cumulative_cash | money: store.currency() }}
                  </td>
                  <td class="cm-num">
                    {{ result.stressed.liquidity.min_cumulative_cash | money: store.currency() }}
                  </td>
                  <td class="cm-num" [class]="deltaClass(result.deltas.min_cumulative_cash)">
                    @if (result.deltas.min_cumulative_cash !== null) {
                      {{ result.deltas.min_cumulative_cash | money: store.currency() }}
                    }
                  </td>
                </tr>
                <tr>
                  <td>{{ 'crisis.stress.liquidityGap' | translate }}</td>
                  <td class="cm-num">
                    {{ result.baseline.liquidity.liquidity_gap | money: store.currency() }}
                  </td>
                  <td class="cm-num">
                    {{ result.stressed.liquidity.liquidity_gap | money: store.currency() }}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td>{{ 'crisis.stress.firstNegative' | translate }}</td>
                  <td class="cm-num">
                    {{ result.baseline.liquidity.first_negative_month ?? '-' }}
                  </td>
                  <td class="cm-num">
                    {{ result.stressed.liquidity.first_negative_month ?? '-' }}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td>{{ 'crisis.stress.capitalCoverage' | translate }}</td>
                  <td class="cm-num">{{ ratio(result.baseline.capital.coverage_ratio) }}</td>
                  <td class="cm-num">{{ ratio(result.stressed.capital.coverage_ratio) }}</td>
                  <td class="cm-num" [class]="deltaClass(result.deltas.coverage_ratio)">
                    {{ signed(result.deltas.coverage_ratio) }}
                  </td>
                </tr>
                <tr>
                  <td>{{ 'crisis.stress.cciiOverall' | translate }}</td>
                  <td class="cm-num">
                    <nz-tag [nzColor]="tone(result.baseline.ccii_overall)">
                      {{ 'crisis.status.' + result.baseline.ccii_overall | translate }}
                    </nz-tag>
                  </td>
                  <td class="cm-num">
                    <nz-tag [nzColor]="tone(result.stressed.ccii_overall)">
                      {{ 'crisis.status.' + result.stressed.ccii_overall | translate }}
                    </nz-tag>
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td>{{ 'crisis.stress.swissOverall' | translate }}</td>
                  <td class="cm-num">
                    <nz-tag [nzColor]="tone(result.baseline.swiss_overall)">
                      {{ 'crisis.status.' + result.baseline.swiss_overall | translate }}
                    </nz-tag>
                  </td>
                  <td class="cm-num">
                    <nz-tag [nzColor]="tone(result.stressed.swiss_overall)">
                      {{ 'crisis.status.' + result.stressed.swiss_overall | translate }}
                    </nz-tag>
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <p class="cm-note">{{ 'crisis.stress.notPersisted' | translate }}</p>
          } @else {
            <nz-empty [nzNotFoundContent]="'crisis.stress.empty' | translate" />
          }
        </nz-spin>
      </nz-card>
    </div>
  `,
})
export class CmStressTestComponent {
  protected readonly store = inject(CrisisMonitoringStore);
  protected readonly specs = STRESS_SPECS;
  protected readonly dscrRows = DSCR_ROWS;
  protected readonly ratio = formatRatio;
  protected readonly signed = formatSigned;

  protected value(spec: StressSpec): number {
    return this.store.stressInput()[spec.key];
  }

  protected set(spec: StressSpec, value: number | null): void {
    this.store.setStress({ [spec.key]: value ?? 0 } as Partial<CrisisStressInput>);
  }

  protected tone(status: CrisisStatus): string {
    return statusTone(status);
  }

  protected dscrText(lite: CrisisStressLite, row: DscrRow): string {
    const dscr = lite.dscr[row.approach][row.horizon];

    return dscr.applicable && dscr.value !== null ? formatRatio(dscr.value) : '-';
  }

  /** Colour class of a delta: a falling cover is bad news. */
  protected deltaClass(delta: string | null): string {
    return delta === null || num(delta) === 0 ? '' : num(delta) < 0 ? 'cm-negative' : 'cm-positive';
  }
}
