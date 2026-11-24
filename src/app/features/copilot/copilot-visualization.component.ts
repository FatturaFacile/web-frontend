import { Component, DestroyRef, effect, ElementRef, inject, input, signal, viewChild, computed } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { downloadBlob } from '@shared/utils/download-blob';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { ECharts } from 'echarts/core';
import type { CopilotVisualization } from './copilot.models';
import { visualizationOption, visualizationToCsv } from './copilot-csv';

let echartsLoader: Promise<typeof import('echarts/core')> | null = null;

function loadEcharts(): Promise<typeof import('echarts/core')> {
  echartsLoader ??= (async () => {
    const [core, charts, components, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]);
    core.use([charts.BarChart, charts.LineChart, charts.PieChart, components.GridComponent, components.TooltipComponent, components.LegendComponent, renderers.CanvasRenderer]);

    return core;
  })();

  return echartsLoader;
}

/** Inline analytics widget: chart or KPI card with a toggleable summary table and CSV export. */
@Component({
  selector: 'app-copilot-visualization',
  imports: [NzButtonModule, TranslatePipe],
  template: `
    <div class="cp-viz" data-testid="copilot-visualization">
      <div class="cp-viz-head">
        <strong>{{ viz().title }}</strong>
        <span class="cp-viz-actions">
          @if (viz().rows.length > 0) {
            <button nz-button nzSize="small" type="button" (click)="showTable.set(!showTable())" [attr.aria-pressed]="showTable()" data-testid="copilot-viz-toggle">
              {{ (showTable() ? 'COPILOT.VIZ.HIDE_TABLE' : 'COPILOT.VIZ.SHOW_TABLE') | translate }}
            </button>
            <button nz-button nzSize="small" type="button" (click)="exportCsv()" data-testid="copilot-viz-csv">{{ 'COPILOT.VIZ.EXPORT_CSV' | translate }}</button>
          }
        </span>
      </div>
      @if (viz().type === 'kpi_card') {
        <div class="cp-kpi" data-testid="copilot-kpi">
          <span class="cp-kpi-value">{{ viz().value }}</span>
          <span class="cp-kpi-metric">{{ viz().metric }}</span>
        </div>
      } @else if (hasChart()) {
        <div #chart class="cp-chart" role="img" [attr.aria-label]="viz().title"></div>
      }
      @if (showTable() || (!hasChart() && viz().type !== 'kpi_card')) {
        <div class="cp-table-wrap">
          <table data-testid="copilot-viz-table">
            <thead>
              <tr>
                @for (c of columns(); track c) {
                  <th>{{ c }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of viz().rows; track $index) {
                <tr>
                  @for (c of columns(); track c) {
                    <td>{{ row[c] }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .cp-viz { margin-top: 8px; padding: 8px; border: 1px solid var(--ff-color-border-subtle); border-radius: 8px; }
    .cp-viz-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .cp-viz-actions { display: flex; gap: 4px; }
    .cp-chart { width: 100%; height: 240px; }
    .cp-kpi { display: flex; flex-direction: column; padding: 8px 0; }
    .cp-kpi-value { font-size: 28px; font-weight: 600; }
    .cp-table-wrap { overflow-x: auto; margin-top: 8px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { padding: 2px 8px; border: 1px solid var(--ff-color-border-subtle); text-align: left; }
  `,
})
export class CopilotVisualizationComponent {
  readonly viz = input.required<CopilotVisualization>();
  protected readonly showTable = signal(false);
  protected readonly columns = computed(() => {
    const v = this.viz();

    return v.columns.length > 0 ? v.columns : Object.keys(v.rows[0] ?? {});
  });
  protected readonly hasChart = computed(() => visualizationOption(this.viz()) !== null);

  private readonly host = viewChild<ElementRef<HTMLElement>>('chart');
  private instance: ECharts | null = null;
  private disposed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      this.instance?.dispose();
    });
    effect(() => {
      const element = this.host()?.nativeElement;
      const option = visualizationOption(this.viz());
      if (element && option) {
        void this.draw(element, option);
      }
    });
  }

  exportCsv(): void {
    const blob = new Blob([`﻿${visualizationToCsv(this.viz())}`], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `${this.viz().title.replace(/[^\w-]+/g, '_') || 'copilot'}.csv`);
  }

  private async draw(element: HTMLElement, option: Record<string, unknown>): Promise<void> {
    const echarts = await loadEcharts();
    if (this.disposed) return;
    this.instance ??= echarts.init(element);
    this.instance.setOption(option, true);
  }
}
