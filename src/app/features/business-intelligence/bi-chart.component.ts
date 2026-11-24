import { Component, computed, input, output } from '@angular/core';
import { BiQueryResult } from '@core';
import { BiChartPoint, chartPoints } from './bi.util';

/** Palette of the series: --ff-color-chart-* tokens, defined per theme (>= 3:1 on the surface in light and dark). */
const COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--ff-color-chart-${n})`);

interface Slice {
  point: BiChartPoint;
  path: string;
  color: string;
  share: number;
}

/**
 * A bar, line or pie chart of the first dimension against the first measure of a query result, drawn in SVG without a
 * charting library. A click or the Enter key on a point emits its raw dimension value, which is what a drill-down filters on.
 */
@Component({
  selector: 'app-bi-chart',
  template: `
    @if (points().length > 0) {
      @switch (type()) {
        @case ('pie') {
          <div class="bi-pie">
            <svg viewBox="-110 -110 220 220" role="img" [attr.aria-label]="label()">
              @for (slice of slices(); track $index) {
                <path [attr.d]="slice.path" [style.fill]="slice.color" class="bi-point" tabindex="0" role="button" (click)="pointClick.emit(slice.point)" (keydown.enter)="pointClick.emit(slice.point)">
                  <title>{{ slice.point.label }}: {{ slice.point.value }}</title>
                </path>
              }
            </svg>
            <ul class="bi-legend">
              @for (slice of slices(); track $index) {
                <li><span class="bi-swatch" [style.background]="slice.color"></span>{{ slice.point.label }} ({{ slice.share }} %)</li>
              }
            </ul>
          </div>
        }
        @case ('line') {
          <svg viewBox="0 0 400 220" role="img" [attr.aria-label]="label()" class="bi-svg">
            <polyline [attr.points]="linePoints()" fill="none" style="stroke: var(--ff-color-chart-1)" stroke-width="2"></polyline>
            @for (dot of dots(); track $index) {
              <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="4" style="fill: var(--ff-color-chart-1)" class="bi-point" tabindex="0" role="button" (click)="pointClick.emit(dot.point)" (keydown.enter)="pointClick.emit(dot.point)">
                <title>{{ dot.point.label }}: {{ dot.point.value }}</title>
              </circle>
              <text [attr.x]="dot.x" y="214" text-anchor="middle" class="bi-axis">{{ dot.short }}</text>
            }
          </svg>
        }
        @default {
          <svg viewBox="0 0 400 220" role="img" [attr.aria-label]="label()" class="bi-svg">
            @for (bar of bars(); track $index) {
              <rect [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" style="fill: var(--ff-color-chart-1)" class="bi-point" tabindex="0" role="button" (click)="pointClick.emit(bar.point)" (keydown.enter)="pointClick.emit(bar.point)">
                <title>{{ bar.point.label }}: {{ bar.point.value }}</title>
              </rect>
              <text [attr.x]="bar.x + bar.width / 2" y="214" text-anchor="middle" class="bi-axis">{{ bar.short }}</text>
            }
          </svg>
        }
      }
    }
  `,
  styles: `
    .bi-svg { width: 100%; height: auto; max-height: 100%; }
    .bi-pie { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .bi-pie svg { width: 160px; height: 160px; }
    .bi-legend { list-style: none; margin: 0; padding: 0; font-size: 12px; }
    .bi-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
    .bi-axis { font-size: 9px; fill: var(--ff-color-text-secondary); }
    .bi-point { cursor: pointer; }
    .bi-point:focus { outline: 2px solid var(--ff-color-focus); }
  `,
})
export class BiChartComponent {
  readonly result = input<BiQueryResult | null>(null);
  readonly type = input<'bar' | 'line' | 'pie'>('bar');
  readonly label = input('');
  readonly pointClick = output<BiChartPoint>();

  readonly points = computed(() => chartPoints(this.result()).slice(0, 24));

  readonly bars = computed(() => {
    const points = this.points();
    const max = Math.max(...points.map((point) => point.value), 0) || 1;
    const slot = 380 / points.length;
    return points.map((point, index) => {
      const height = Math.max(1, (Math.max(point.value, 0) / max) * 170);
      return { point, x: 10 + index * slot + slot * 0.1, width: slot * 0.8, y: 190 - height, height, short: this.short(point.label) };
    });
  });

  readonly dots = computed(() => {
    const points = this.points();
    const max = Math.max(...points.map((point) => point.value), 0) || 1;
    const step = points.length > 1 ? 360 / (points.length - 1) : 0;
    return points.map((point, index) => ({ point, x: 20 + index * step, y: 190 - (Math.max(point.value, 0) / max) * 170, short: this.short(point.label) }));
  });

  readonly linePoints = computed(() => this.dots().map((dot) => `${dot.x},${dot.y}`).join(' '));

  readonly slices = computed<Slice[]>(() => {
    const points = this.points().filter((point) => point.value > 0);
    const total = points.reduce((sum, point) => sum + point.value, 0) || 1;
    let angle = -Math.PI / 2;
    return points.map((point, index) => {
      const share = point.value / total;
      const next = angle + share * Math.PI * 2;
      const large = share > 0.5 ? 1 : 0;
      const [x1, y1, x2, y2] = [Math.cos(angle) * 100, Math.sin(angle) * 100, Math.cos(next) * 100, Math.sin(next) * 100];
      const path = share >= 0.9999 ? 'M0,-100 A100,100 0 1 1 0,100 A100,100 0 1 1 0,-100 Z' : `M0,0 L${x1},${y1} A100,100 0 ${large} 1 ${x2},${y2} Z`;
      angle = next;
      return { point, path, color: COLORS[index % COLORS.length], share: Math.round(share * 100) };
    });
  });

  private short(label: string): string {
    return label.length > 9 ? `${label.slice(0, 8)}…` : label;
  }
}
