import { Component, computed, inject, model } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { catchError, debounceTime, EMPTY, switchMap } from 'rxjs';
import { WhatIfScenario } from './dss.models';
import { formatAmount, isNeutralScenario, SCENARIO_RANGES } from './dss.utils';
import { ExecutiveDssStore } from './executive-dss.store';

export const SCENARIO_DEBOUNCE_MS = 300;

const SLIDERS: readonly { key: keyof WhatIfScenario; unit: 'percent' | 'days' | 'fte' }[] = [
  { key: 'price_pct', unit: 'percent' },
  { key: 'cogs_pct', unit: 'percent' },
  { key: 'opex_pct', unit: 'percent' },
  { key: 'dso_days_delta', unit: 'days' },
  { key: 'fx_shift_pct', unit: 'percent' },
  { key: 'fte_delta', unit: 'fte' },
];

/**
 * What-if scenario simulator in a drawer: six sliders (price, COGS, OPEX, DSO days, EUR/CHF shift, FTE) and the baseline
 * against the simulated EBITDA, net cash flow and break-even. The scenario is run on the server after a short pause, so the
 * numbers follow the sliders without a request on every tick.
 */
@Component({
  selector: 'app-what-if-simulator',
  styleUrl: './dss.scss',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzSliderModule,
    NzSpinModule,
    NzStatisticModule,
  ],
  template: `
    <nz-drawer
      nzPlacement="right"
      [nzWidth]="460"
      [nzVisible]="open()"
      [nzTitle]="'EXEC_DSS.WHATIF_TITLE' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <div data-testid="what-if">
          @for (slider of sliders; track slider.key) {
            <label class="sim-label" [attr.for]="'slider-' + slider.key">
              {{ 'EXEC_DSS.SIM_' + slider.key.toUpperCase() | translate }}
              <span class="sim-value" [attr.data-testid]="'value-' + slider.key">{{
                valueText(slider.key)
              }}</span>
            </label>
            <nz-slider
              [attr.data-testid]="'slider-' + slider.key"
              [nzMin]="ranges[slider.key].min"
              [nzMax]="ranges[slider.key].max"
              [nzStep]="ranges[slider.key].step"
              [ngModel]="store.scenario()[slider.key]"
              (ngModelChange)="onSlider(slider.key, $event)"
            ></nz-slider>
          }

          <nz-spin [nzSpinning]="store.simulating()">
            @if (store.simulation(); as result) {
              <div class="sim-compare" data-testid="sim-result">
                @for (row of rows(); track row.key) {
                  <nz-card nzSize="small">
                    <nz-statistic
                      [nzTitle]="'EXEC_DSS.SIM_' + row.key.toUpperCase() | translate"
                      [nzValue]="row.simulated"
                    ></nz-statistic>
                    <span class="muted"
                      >{{ 'EXEC_DSS.SIM_BASELINE' | translate }}: {{ row.baseline }}</span
                    >
                    <span [class]="row.delta.startsWith('-') ? 'delta-negative' : 'delta-positive'">
                      · {{ row.delta }}</span
                    >
                  </nz-card>
                }
                @if (result.simulated.break_even_revenue === null) {
                  <nz-alert
                    nzType="warning"
                    nzShowIcon
                    data-testid="no-break-even"
                    [nzMessage]="'EXEC_DSS.SIM_NO_BREAK_EVEN' | translate"
                  ></nz-alert>
                }
              </div>
            } @else if (neutral()) {
              <p class="muted" data-testid="sim-hint">{{ 'EXEC_DSS.SIM_HINT' | translate }}</p>
            }
          </nz-spin>

          <button
            nz-button
            class="sim-label"
            data-testid="sim-reset"
            (click)="store.resetScenario()"
          >
            {{ 'EXEC_DSS.SIM_RESET' | translate }}
          </button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
})
export class WhatIfSimulatorComponent {
  protected readonly store = inject(ExecutiveDssStore);
  private readonly i18n = inject(TranslateService);

  readonly open = model(false);

  protected readonly sliders = SLIDERS;
  protected readonly ranges = SCENARIO_RANGES;
  protected readonly neutral = computed(() => isNeutralScenario(this.store.scenario()));

  /** EBITDA, net cash flow and break-even of the baseline and the simulation, formatted. */
  protected readonly rows = computed(() => {
    const result = this.store.simulation();

    if (result === null) {
      return [];
    }

    const money = (value: number): string =>
      formatAmount(value, result.currency, this.i18n.currentLanguage());
    const dash = '–';

    return [
      {
        key: 'ebitda',
        baseline: money(result.baseline.ebitda),
        simulated: money(result.simulated.ebitda),
        delta: money(result.delta.ebitda),
      },
      {
        key: 'net_cash_flow',
        baseline: money(result.baseline.net_cash_flow),
        simulated: money(result.simulated.net_cash_flow),
        delta: money(result.delta.net_cash_flow),
      },
      {
        key: 'break_even',
        baseline:
          result.baseline.break_even_revenue === null
            ? dash
            : money(result.baseline.break_even_revenue),
        simulated:
          result.simulated.break_even_revenue === null
            ? dash
            : money(result.simulated.break_even_revenue),
        delta:
          result.delta.break_even_revenue === null ? dash : money(result.delta.break_even_revenue),
      },
    ];
  });

  constructor() {
    // Every slider move (and every change of the filter behind it) reruns the scenario once the user pauses.
    toObservable(
      computed(() => ({
        scenario: this.store.scenario(),
        filter: this.store.filters(),
        open: this.open(),
      })),
    )
      .pipe(
        debounceTime(SCENARIO_DEBOUNCE_MS),
        switchMap(({ scenario, open }) => {
          if (!open) {
            return EMPTY;
          }

          if (isNeutralScenario(scenario)) {
            this.store.simulation.set(null);

            return EMPTY;
          }

          return this.store.runSimulation().pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected onSlider(key: keyof WhatIfScenario, value: number): void {
    this.store.setScenario({ [key]: value });
  }

  protected valueText(key: keyof WhatIfScenario): string {
    const value = this.store.scenario()[key];
    const unit = SLIDERS.find((slider) => slider.key === key)?.unit;
    const sign = value > 0 ? '+' : '';

    return unit === 'percent' ? `${sign}${value}%` : `${sign}${value}`;
  }
}
