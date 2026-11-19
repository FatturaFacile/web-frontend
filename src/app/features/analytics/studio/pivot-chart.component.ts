import { Component, DestroyRef, effect, ElementRef, inject, input, viewChild } from '@angular/core';
import { PivotChart } from '@core';
import type { EChartsCoreOption, ECharts } from 'echarts/core';

/**
 * Builds the ECharts option of a pivot chart: the categories and series come ready from the API, the chart type decides
 * how they are drawn (stacked bars, areas, doughnut, combo of bars with a line for the last series).
 */
export function chartOption(chart: PivotChart): EChartsCoreOption {
  const numeric = (data: (string | number | null)[]): (number | null)[] =>
    data.map((item) => (item === null ? null : Number(item)));
  const labels = { show: chart.show_data_labels };
  const legend = chart.show_legend ? { type: 'scroll' as const, bottom: 0 } : { show: false };

  if (chart.type === 'pie' || chart.type === 'donut') {
    const first = chart.series[0];

    return {
      tooltip: { trigger: 'item' },
      legend,
      series: [
        {
          type: 'pie',
          radius: chart.type === 'donut' ? ['45%', '70%'] : '70%',
          label: labels,
          data: chart.categories.map((name, index) => ({
            name,
            value: Number(first?.data[index] ?? 0),
          })),
        },
      ],
    };
  }

  const lastIndex = chart.series.length - 1;

  return {
    tooltip: { trigger: 'axis' },
    legend,
    grid: { left: 56, right: 24, top: 24, bottom: chart.show_legend ? 48 : 24, containLabel: true },
    xAxis: { type: 'category', data: chart.categories, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value' },
    series: chart.series.map((item, index) => {
      const line =
        chart.type === 'line' ||
        chart.type === 'area' ||
        (chart.type === 'combo' && index === lastIndex && lastIndex > 0);

      return {
        name: item.name,
        type: line ? 'line' : 'bar',
        stack: chart.type === 'stacked_bar' ? 'total' : undefined,
        areaStyle: chart.type === 'area' ? {} : undefined,
        label: labels,
        data: numeric(item.data),
      };
    }),
  };
}

/** The chart of a pivot. ECharts is loaded the first time a chart is drawn, so it stays out of the initial bundle. */
@Component({
  selector: 'app-pivot-chart',
  template: `<div
    #host
    class="chart"
    role="img"
    [attr.aria-label]="label()"
    data-testid="pivot-chart"
  ></div>`,
  styles: [':host{display:block}.chart{width:100%;height:360px}'],
})
export class PivotChartComponent {
  readonly chart = input.required<PivotChart | null>();
  readonly label = input<string>('');

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private instance: ECharts | null = null;
  private disposed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      this.instance?.dispose();
    });

    effect(() => {
      const chart = this.chart();
      const element = this.host().nativeElement;

      if (chart === null) {
        this.instance?.clear();

        return;
      }

      void this.draw(element, chart);
    });
  }

  private async draw(element: HTMLElement, chart: PivotChart): Promise<void> {
    const echarts = await loadEcharts();

    if (this.disposed) {
      return;
    }

    this.instance ??= echarts.init(element);
    this.instance.setOption(chartOption(chart), true);
    this.instance.resize();
  }
}

let loaded: Promise<typeof import('echarts/core')> | null = null;

/** Registers only the charts and components the studio uses. */
function loadEcharts(): Promise<typeof import('echarts/core')> {
  loaded ??= (async () => {
    const [core, charts, components, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]);
    core.use([
      charts.BarChart,
      charts.LineChart,
      charts.PieChart,
      components.GridComponent,
      components.TooltipComponent,
      components.LegendComponent,
      renderers.CanvasRenderer,
    ]);

    return core;
  })();

  return loaded;
}
