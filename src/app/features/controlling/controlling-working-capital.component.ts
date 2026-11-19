import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { catchError, of, switchMap } from 'rxjs';
import { ControllingApiService, FinancialKpis } from '@core';
import { TranslatePipe } from '@shared';
import { ControllingFilters } from './controlling-filters.service';

interface Series {
  key: string;
  color: string;
  points: string;
}

const CHART_W = 600;
const CHART_H = 240;

function polyline(values: number[], max: number, min = 0): string {
  const step = (CHART_W - 60) / Math.max(1, values.length - 1);
  return values
    .map(
      (value, index) =>
        `${40 + index * step},${CHART_H - 20 - ((value - min) / (max - min || 1)) * (CHART_H - 40)}`,
    )
    .join(' ');
}

/** Tab 2 — working capital and financial ratios: DSO, DPO, CCN, inventory turnover, the cash conversion cycle and 12-month trends. */
@Component({
  selector: 'app-controlling-working-capital',
  styleUrl: './controlling.scss',
  imports: [DecimalPipe, TranslatePipe, NzCardModule, NzEmptyModule, NzTooltipModule],
  template: `
    @if (kpis(); as k) {
      @if (k.current; as c) {
        <div class="banner" role="status">
          {{ 'CONTROLLING.CCC' | translate }}: {{ c.dio | number: '1.1-1' }} (DIO) +
          {{ c.dso | number: '1.1-1' }} (DSO) − {{ c.dpo | number: '1.1-1' }} (DPO) =
          <strong>{{ c.ccc | number: '1.1-1' }} {{ 'CONTROLLING.DAYS' | translate }}</strong>
        </div>

        <div class="kpi-ribbon">
          @for (card of cards(); track card.key) {
            <div class="kpi" [nz-tooltip]="k.formulas[card.key]">
              <div class="label">
                {{ 'CONTROLLING.RATIO_' + card.key.toUpperCase() | translate }} ⓘ
              </div>
              <div class="value">{{ card.value | number: (card.money ? '1.0-0' : '1.1-1') }}</div>
              @if (card.delta !== null) {
                <div [class]="card.good ? 'badge-up' : 'badge-down'">
                  {{ card.delta > 0 ? '▲' : card.delta < 0 ? '▼' : '=' }}
                  {{ card.delta | number: '1.0-1' }}
                </div>
              }
            </div>
          }
          <div class="kpi">
            <div class="label">{{ 'CONTROLLING.OVERDUE_PERCENT' | translate }}</div>
            <div class="value">{{ c.overdue_receivables_percent | number: '1.1-1' }} %</div>
            <div class="label">
              {{ 'CONTROLLING.COUNTBACK_DSO' | translate }}: {{ k.countback_dso | number: '1.0-0' }}
            </div>
          </div>
        </div>

        <div class="grid-2">
          <nz-card [nzTitle]="'CONTROLLING.TREND_DAYS' | translate" class="main-card">
            <svg
              class="chart"
              [attr.viewBox]="'0 0 600 240'"
              role="img"
              [attr.aria-label]="'CONTROLLING.TREND_DAYS' | translate"
            >
              @for (s of daySeries(); track s.key) {
                <polyline
                  [attr.points]="s.points"
                  fill="none"
                  [attr.stroke]="s.color"
                  stroke-width="2"
                />
              }
              @for (s of daySeries(); track s.key; let i = $index) {
                <text [attr.x]="45 + i * 70" y="12" [attr.fill]="s.color">{{ s.key }}</text>
              }
            </svg>
          </nz-card>
          <nz-card [nzTitle]="'CONTROLLING.TREND_CCN' | translate" class="main-card">
            <svg
              class="chart"
              [attr.viewBox]="'0 0 600 240'"
              role="img"
              [attr.aria-label]="'CONTROLLING.TREND_CCN' | translate"
            >
              @for (bar of ccnBars(); track bar.key) {
                <rect
                  [attr.x]="bar.x"
                  [attr.y]="bar.invY"
                  [attr.width]="bar.w"
                  [attr.height]="bar.invH"
                  fill="#1677ff"
                />
                <rect
                  [attr.x]="bar.x"
                  [attr.y]="bar.arY"
                  [attr.width]="bar.w"
                  [attr.height]="bar.arH"
                  fill="#52c41a"
                />
                <rect
                  [attr.x]="bar.x"
                  [attr.y]="bar.apY"
                  [attr.width]="bar.w"
                  [attr.height]="bar.apH"
                  fill="#cf1322"
                  fill-opacity="0.7"
                />
              }
              <text x="45" y="12">
                + {{ 'CONTROLLING.RATIO_INVENTORY' | translate }} +
                {{ 'CONTROLLING.RATIO_AR' | translate }} −
                {{ 'CONTROLLING.RATIO_AP' | translate }} = {{ 'CONTROLLING.RATIO_CCN' | translate }}
              </text>
            </svg>
          </nz-card>
        </div>

        <nz-card [nzTitle]="'CONTROLLING.TREND_TURNOVER' | translate" class="main-card">
          <svg
            class="chart"
            [attr.viewBox]="'0 0 600 240'"
            role="img"
            [attr.aria-label]="'CONTROLLING.TREND_TURNOVER' | translate"
          >
            <polyline
              [attr.points]="turnoverLine()"
              fill="none"
              stroke="#722ed1"
              stroke-width="2"
            />
          </svg>
        </nz-card>
      } @else {
        <nz-empty [nzNotFoundContent]="'CONTROLLING.NO_SNAPSHOTS' | translate"></nz-empty>
      }
    }
  `,
})
export class ControllingWorkingCapitalComponent {
  private readonly api = inject(ControllingApiService);
  private readonly filters = inject(ControllingFilters);

  protected readonly kpis = signal<FinancialKpis | null>(null);

  protected readonly cards = computed(() => {
    const k = this.kpis();
    const c = k?.current;
    if (!k || !c) return [];
    const d = k.deltas;
    const card = (key: string, value: string, money: boolean, inverse: boolean) => {
      const delta = d && d[key] !== undefined ? Number(d[key]) : null;
      return {
        key,
        value: Number(value),
        money,
        delta,
        good: delta === null ? true : inverse ? delta <= 0 : delta >= 0,
      };
    };
    return [
      card('dso', c.dso, false, true),
      card('dpo', c.dpo, false, false),
      card('ccn', c.ccn, true, true),
      card('inventory_turnover', c.inventory_turnover, false, false),
    ];
  });

  protected readonly daySeries = computed<Series[]>(() => {
    const history = this.kpis()?.history ?? [];
    const values = history.flatMap((p) => [Number(p.dso), Number(p.dpo), Number(p.dio)]);
    const max = Math.max(1, ...values);
    return [
      {
        key: 'DSO',
        color: '#1677ff',
        points: polyline(
          history.map((p) => Number(p.dso)),
          max,
        ),
      },
      {
        key: 'DPO',
        color: '#cf1322',
        points: polyline(
          history.map((p) => Number(p.dpo)),
          max,
        ),
      },
      {
        key: 'DIO',
        color: '#52c41a',
        points: polyline(
          history.map((p) => Number(p.dio)),
          max,
        ),
      },
    ];
  });

  protected readonly turnoverLine = computed(() => {
    const history = this.kpis()?.history ?? [];
    return polyline(
      history.map((p) => Number(p.inventory_turnover)),
      Math.max(1, ...history.map((p) => Number(p.inventory_turnover))),
    );
  });

  protected readonly ccnBars = computed(() => {
    const history = this.kpis()?.history ?? [];
    const top = Math.max(
      1,
      ...history.map((p) => Number(p.inventory) + Number(p.accounts_receivable)),
    );
    const scale = (CHART_H - 40) / top;
    const width = (CHART_W - 60) / Math.max(1, history.length);
    return history.map((p, index) => {
      const inv = Number(p.inventory) * scale;
      const ar = Number(p.accounts_receivable) * scale;
      const ap = Number(p.accounts_payable) * scale;
      const x = 40 + index * width;
      return {
        key: p.snapshot_date,
        x,
        w: Math.max(2, width - 4),
        invH: inv,
        invY: CHART_H - 20 - inv,
        arH: ar,
        arY: CHART_H - 20 - inv - ar,
        apH: ap,
        apY: CHART_H - 20 - ap,
      };
    });
  });

  constructor() {
    toObservable(this.filters.dateTo)
      .pipe(
        switchMap((dateTo) =>
          this.api.getFinancialKpis(dateTo, 12).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((response) => this.kpis.set(response?.data ?? null));
  }
}
