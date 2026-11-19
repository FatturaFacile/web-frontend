import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, debounceTime, forkJoin, of, switchMap, tap } from 'rxjs';
import { ControllingApiService, DrillStep, MARGIN_DIMENSIONS, MarginDimension, MarginExplore, MarginMatrix, MarginPareto, MarginRow, MarginSummary } from '@core';
import { TranslatePipe } from '@shared';
import { ControllingFilters } from './controlling-filters.service';

const MARGIN_ALERT_PERCENT = 10;

interface Bubble {
  key: string;
  label: string;
  x: number;
  y: number;
  r: number;
  quadrant: 'stars' | 'cash_cows' | 'volume_traps' | 'loss_makers';
}

/** Tab 1 — multidimensional margin explorer (#216): KPI ribbon, dimension switcher with drill-down, quadrant, Pareto and cross-tab. */
@Component({
  selector: 'app-controlling-margins',
  styleUrl: './controlling.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    @if (summary(); as s) {
      <div class="kpi-ribbon">
        @for (kpi of kpis(); track kpi.key) {
          <div class="kpi">
            <div class="label">{{ 'CONTROLLING.KPI_' + kpi.key.toUpperCase() | translate }}</div>
            <div class="value">{{ kpi.value | number: kpi.percent ? '1.1-1' : '1.0-0' }}{{ kpi.percent ? ' %' : '' }}</div>
            @if (kpi.delta !== null) {
              <div [class]="kpi.good ? 'badge-up' : 'badge-down'">{{ kpi.delta > 0 ? '▲' : kpi.delta < 0 ? '▼' : '=' }} {{ kpi.delta | number: '1.0-1' }}{{ kpi.percent ? ' pp' : ' %' }}</div>
            }
          </div>
        }
      </div>
    }

    <div class="chips" role="navigation" [attr.aria-label]="'CONTROLLING.BREADCRUMB' | translate">
      <nz-select style="width: 220px" [ngModel]="groupBy()" (ngModelChange)="switchDimension($event)" [attr.aria-label]="'CONTROLLING.GROUP_BY' | translate">
        @for (dimension of dimensions; track dimension) {
          <nz-option [nzValue]="dimension" [nzLabel]="'CONTROLLING.DIM_' + dimension.toUpperCase() | translate"></nz-option>
        }
      </nz-select>
      <nz-tag nzMode="default" (click)="resetDrill()" style="cursor: pointer">{{ 'CONTROLLING.ALL' | translate }}</nz-tag>
      @for (step of drill(); track $index) {
        <nz-tag nzMode="closeable" (nzOnClose)="trimDrill($index)">{{ 'CONTROLLING.DIM_' + step.dimension.toUpperCase() | translate }}: {{ step.label }}</nz-tag>
      }
    </div>

    <div class="grid-2">
      <nz-card [nzTitle]="'CONTROLLING.QUADRANT' | translate" class="main-card">
        @if (bubbles().length) {
          <svg class="chart" viewBox="0 0 600 320" role="img" [attr.aria-label]="'CONTROLLING.QUADRANT' | translate">
            <line x1="40" y1="10" x2="40" y2="290" stroke="#d9d9d9" />
            <line x1="40" y1="290" x2="590" y2="290" stroke="#d9d9d9" />
            <line [attr.x1]="40" [attr.x2]="590" [attr.y1]="zeroLine()" [attr.y2]="zeroLine()" stroke="#ff7875" stroke-dasharray="4" />
            @for (b of bubbles(); track b.key) {
              <circle [attr.cx]="b.x" [attr.cy]="b.y" [attr.r]="b.r" [attr.fill]="color(b.quadrant)" fill-opacity="0.65">
                <title>{{ b.label }}</title>
              </circle>
            }
            <text x="45" y="22">{{ 'CONTROLLING.QUAD_STARS' | translate }}</text>
            <text x="590" y="22" text-anchor="end">{{ 'CONTROLLING.QUAD_CASH_COWS' | translate }}</text>
            <text x="590" y="285" text-anchor="end">{{ 'CONTROLLING.QUAD_VOLUME_TRAPS' | translate }} / {{ 'CONTROLLING.QUAD_LOSS_MAKERS' | translate }}</text>
          </svg>
        } @else {
          <nz-empty [nzNotFoundContent]="'CONTROLLING.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card [nzTitle]="'CONTROLLING.PARETO' | translate" class="main-card">
        @if (pareto(); as p) {
          <svg class="chart" viewBox="0 0 600 320" role="img" [attr.aria-label]="'CONTROLLING.PARETO' | translate">
            @for (bar of paretoBars(); track bar.key) {
              <rect [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.w" [attr.height]="bar.h" [attr.fill]="bar.abc === 'A' ? '#1677ff' : bar.abc === 'B' ? '#faad14' : '#bfbfbf'"><title>{{ bar.label }}</title></rect>
            }
            <polyline [attr.points]="paretoLine()" fill="none" stroke="#cf1322" stroke-width="2" />
            <text x="45" y="14">A {{ p.class_counts.A }} · B {{ p.class_counts.B }} · C {{ p.class_counts.C }}</text>
          </svg>
        }
      </nz-card>
    </div>

    <nz-card [nzTitle]="'CONTROLLING.EXPLORER' | translate" class="main-card">
      <nz-table #table [nzData]="rows()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25" [nzFrontPagination]="true">
        <thead>
          <tr>
            <th>{{ 'CONTROLLING.ENTITY' | translate }}</th>
            <th class="num" (click)="sortBy('quantity')">{{ 'CONTROLLING.QUANTITY' | translate }}</th>
            <th class="num" (click)="sortBy('net_revenue')">{{ 'CONTROLLING.KPI_NET_REVENUE' | translate }}</th>
            <th class="num" (click)="sortBy('direct_cogs')">{{ 'CONTROLLING.KPI_DIRECT_COGS' | translate }}</th>
            <th class="num" (click)="sortBy('margin')">{{ 'CONTROLLING.MARGIN' | translate }}</th>
            <th>{{ 'CONTROLLING.MARGIN_PERCENT' | translate }}</th>
            <th>ABC</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.key) {
            <tr>
              <td>
                @if (canDrill()) {
                  <a (click)="drillInto(row)" (keydown.enter)="drillInto(row)" tabindex="0">{{ row.label }}</a>
                } @else {
                  {{ row.label }}
                }
              </td>
              <td class="num">{{ row.metrics.quantity | number: '1.0-0' }}</td>
              <td class="num">{{ row.metrics.net_revenue | number: '1.0-0' }}</td>
              <td class="num">{{ row.metrics.direct_cogs | number: '1.0-0' }}</td>
              <td class="num">{{ row.metrics.margin | number: '1.0-0' }}</td>
              <td style="min-width: 150px">
                <div class="bar-track"><span [style.width.%]="clamp(+row.metrics.margin_percent)" [style.background]="+row.metrics.margin_percent < 0 ? '#cf1322' : +row.metrics.margin_percent < alertPercent ? '#faad14' : '#52c41a'"></span></div>
                {{ row.metrics.margin_percent | number: '1.1-1' }} %
                @if (+row.metrics.margin_percent < alertPercent) {
                  <nz-tag nzColor="red">{{ 'CONTROLLING.BELOW_TARGET' | translate }}</nz-tag>
                }
              </td>
              <td><nz-tag [nzColor]="row.abc_class === 'A' ? 'blue' : row.abc_class === 'B' ? 'orange' : 'default'">{{ row.abc_class }}</nz-tag></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'CONTROLLING.MATRIX' | translate" class="main-card">
      <nz-select style="width: 220px; margin-bottom: 12px" [ngModel]="colDimension()" (ngModelChange)="colDimension.set($event)" [attr.aria-label]="'CONTROLLING.COL_DIMENSION' | translate">
        @for (dimension of dimensions; track dimension) {
          <nz-option [nzValue]="dimension" [nzLabel]="'CONTROLLING.DIM_' + dimension.toUpperCase() | translate"></nz-option>
        }
      </nz-select>
      @if (matrix(); as m) {
        <div style="overflow-x: auto">
          <table class="heat">
            <thead>
              <tr>
                <th></th>
                @for (col of m.columns; track col.key) {
                  <th class="num">{{ col.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of m.rows; track row.key) {
                <tr>
                  <th>{{ row.label }}</th>
                  @for (col of m.columns; track col.key) {
                    <td class="heat-cell" [style.background]="heat(row.key, col.key)">{{ cell(row.key, col.key) | number: '1.0-1' }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </nz-card>
  `,
})
export class ControllingMarginsComponent {
  private readonly api = inject(ControllingApiService);
  private readonly filters = inject(ControllingFilters);

  protected readonly dimensions = MARGIN_DIMENSIONS;
  protected readonly alertPercent = MARGIN_ALERT_PERCENT;
  protected readonly groupBy = signal<MarginDimension>('product_family');
  protected readonly colDimension = signal<MarginDimension>('geography');
  protected readonly drill = signal<(DrillStep & { label: string })[]>([]);
  protected readonly sort = signal<{ field: string; direction: 'asc' | 'desc' }>({ field: 'net_revenue', direction: 'desc' });
  protected readonly loading = signal(false);
  protected readonly summary = signal<MarginSummary | null>(null);
  protected readonly explore = signal<MarginExplore | null>(null);
  protected readonly pareto = signal<MarginPareto | null>(null);
  protected readonly matrix = signal<MarginMatrix | null>(null);

  protected readonly rows = computed<MarginRow[]>(() => this.explore()?.data ?? []);
  protected readonly canDrill = computed(() => this.drill().length < 4);

  private readonly request = computed(() => ({
    query: this.filters.query(),
    groupBy: this.groupBy(),
    colDimension: this.colDimension(),
    drill: this.drill(),
    sort: this.sort(),
  }));

  protected readonly kpis = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const t = s.totals;
    const d = s.deltas;
    const item = (key: string, value: string, deltaKey: string | null, percent = false, inverse = false) => {
      const delta = d && deltaKey && d[deltaKey] ? Number(percent ? d[deltaKey].delta : d[deltaKey].delta_percent) : null;
      return { key, value: Number(value), percent, delta, good: delta === null ? true : inverse ? delta <= 0 : delta >= 0 };
    };
    return [
      item('net_revenue', t.net_revenue, 'net_revenue'),
      item('direct_cogs', t.direct_cogs, 'direct_cogs', false, true),
      item('allocated_overheads', t.allocated_overheads, 'allocated_overheads', false, true),
      item('gross_margin', t.gross_margin, 'gross_margin'),
      item('gross_margin_percent', t.gross_margin_percent, null, true),
      item('commercial_margin', t.commercial_margin, 'commercial_margin'),
      item('full_industrial_margin', t.full_industrial_margin, 'full_industrial_margin'),
      item('credit_note_incidence', t.credit_note_incidence_percent, null, true),
    ];
  });

  protected readonly bubbles = computed<Bubble[]>(() => {
    const rows = this.rows().filter((row) => Number(row.metrics.net_revenue) > 0);
    if (!rows.length) return [];
    const maxRevenue = Math.max(...rows.map((row) => Number(row.metrics.net_revenue)));
    const percents = rows.map((row) => Number(row.metrics.margin_percent));
    const minY = Math.min(0, ...percents);
    const maxY = Math.max(1, ...percents);
    const sorted = [...rows].map((row) => Number(row.metrics.net_revenue)).sort((a, b) => a - b);
    const medianRevenue = sorted[Math.floor(sorted.length / 2)];
    const overall = Number(this.explore()?.totals.margin_percent ?? 0);
    return rows.map((row) => {
      const revenue = Number(row.metrics.net_revenue);
      const percent = Number(row.metrics.margin_percent);
      const highRevenue = revenue >= medianRevenue;
      const quadrant = percent < 0 ? 'loss_makers' : highRevenue ? (percent >= overall ? 'stars' : 'volume_traps') : 'cash_cows';
      return {
        key: row.key,
        label: `${row.label} · ${percent.toFixed(1)} %`,
        x: 50 + (revenue / maxRevenue) * 530,
        y: 290 - ((percent - minY) / (maxY - minY || 1)) * 270,
        r: 6 + Math.min(14, Math.abs(Number(row.metrics.margin)) / (maxRevenue || 1) * 60),
        quadrant,
      } satisfies Bubble;
    });
  });

  protected readonly zeroLine = computed(() => {
    const percents = this.rows().map((row) => Number(row.metrics.margin_percent));
    const minY = Math.min(0, ...percents);
    const maxY = Math.max(1, ...percents);
    return 290 - ((0 - minY) / (maxY - minY || 1)) * 270;
  });

  protected readonly paretoBars = computed(() => {
    const curve = this.pareto()?.curve ?? [];
    const max = Math.max(1, ...curve.map((point) => Number(point.net_revenue)));
    const width = 540 / Math.max(1, curve.length);
    return curve.map((point, index) => {
      const h = (Math.max(0, Number(point.net_revenue)) / max) * 260;
      return { key: point.key, label: point.label, abc: point.abc_class, x: 50 + index * width, w: Math.max(1, width - 2), y: 290 - h, h };
    });
  });

  protected readonly paretoLine = computed(() => {
    const curve = this.pareto()?.curve ?? [];
    const width = 540 / Math.max(1, curve.length);
    return curve.map((point, index) => `${50 + index * width + width / 2},${290 - (Number(point.cumulative_share) / 100) * 260}`).join(' ');
  });

  constructor() {
    toObservable(this.request)
      .pipe(
        debounceTime(150),
        tap(() => this.loading.set(true)),
        switchMap((request) => {
          const drillPath = request.drill.map(({ dimension, value }) => ({ dimension, value }));
          const base = { ...request.query, drill_path: drillPath };
          return forkJoin({
            summary: this.api.getMarginSummary(request.query),
            explore: this.api.exploreMargins({ ...base, group_by: request.groupBy, per_page: 500, sort: request.sort.field, direction: request.sort.direction }),
            pareto: this.api.getMarginPareto({ ...request.query, group_by: request.groupBy }),
            matrix: this.api.getMarginMatrix({ ...request.query, row_dimension: request.groupBy, col_dimension: request.colDimension }),
          }).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result) return;
        this.summary.set(result.summary.data);
        this.explore.set(result.explore);
        this.pareto.set(result.pareto.data);
        this.matrix.set(result.matrix.data);
      });
  }

  protected switchDimension(dimension: MarginDimension): void {
    this.groupBy.set(dimension);
  }

  protected drillInto(row: MarginRow): void {
    const dimension = this.groupBy();
    const next = this.explore()?.next_dimensions.find((candidate) => candidate !== dimension || dimension === 'geography') ?? dimension;
    this.drill.update((path) => [...path, { dimension, value: row.key, label: row.label }]);
    this.groupBy.set(next);
  }

  protected trimDrill(index: number): void {
    const removed = this.drill()[index];
    this.drill.update((path) => path.slice(0, index));
    if (removed) this.groupBy.set(removed.dimension);
  }

  protected resetDrill(): void {
    this.drill.set([]);
  }

  protected sortBy(field: string): void {
    this.sort.update((current) => ({ field, direction: current.field === field && current.direction === 'desc' ? 'asc' : 'desc' }));
  }

  protected clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  protected color(quadrant: Bubble['quadrant']): string {
    return { stars: '#52c41a', cash_cows: '#1677ff', volume_traps: '#faad14', loss_makers: '#cf1322' }[quadrant];
  }

  protected cell(row: string, col: string): number | null {
    const found = this.matrix()?.cells.find((candidate) => candidate.row === row && candidate.col === col);
    return found ? Number(found.value) : null;
  }

  protected heat(row: string, col: string): string {
    const value = this.cell(row, col);
    if (value === null) return 'transparent';
    const values = (this.matrix()?.cells ?? []).map((candidate) => Number(candidate.value));
    const max = Math.max(...values.map(Math.abs), 1);
    const alpha = Math.min(0.85, Math.abs(value) / max);
    return value < 0 ? `rgba(207, 19, 34, ${alpha})` : `rgba(82, 196, 26, ${alpha})`;
  }
}
