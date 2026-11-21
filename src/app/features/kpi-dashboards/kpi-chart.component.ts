import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

/** What a click on a chart element reports (the subset of the ECharts event the drill-down needs). */
export interface ChartClick {
  name?: string;
  seriesName?: string;
  dataIndex?: number;
  value?: unknown;
}

/**
 * Draws an ECharts option and reports the element the user clicks. ECharts is loaded the first time a chart is shown, so it
 * stays out of the initial bundle, and the chart follows the size of its container (and so the drag-and-drop grid).
 */
@Component({
  selector: 'app-kpi-chart',
  template: `<div
    #host
    class="chart"
    role="img"
    [attr.aria-label]="label()"
    [attr.data-testid]="testId()"
  ></div>`,
  styles: [':host{display:block}.chart{width:100%;height:var(--kpi-chart-height,220px)}'],
})
export class KpiChartComponent {
  readonly option = input.required<EChartsCoreOption | null>();
  /** Accessible description of the chart. */
  readonly label = input<string>('');
  readonly testId = input<string>('kpi-chart');
  readonly chartClick = output<ChartClick>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private instance: ECharts | null = null;
  private observer: ResizeObserver | null = null;
  private disposed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      this.observer?.disconnect();
      this.instance?.dispose();
    });

    effect(() => {
      const option = this.option();
      const element = this.host().nativeElement;

      if (option === null) {
        this.instance?.clear();

        return;
      }

      void this.draw(element, option);
    });
  }

  private async draw(element: HTMLElement, option: EChartsCoreOption): Promise<void> {
    const echarts = await loadEcharts();

    if (this.disposed) {
      return;
    }

    if (this.instance === null) {
      this.instance = echarts.init(element);
      this.instance.on('click', (params: unknown) => this.chartClick.emit(params as ChartClick));

      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => this.instance?.resize());
        this.observer.observe(element);
      }
    }

    this.instance.setOption(option, true);
    this.instance.resize();
  }
}

let loaded: Promise<typeof import('echarts/core')> | null = null;

/** Registers only the charts and components the seven KPI visualizations use. */
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
      charts.FunnelChart,
      charts.GaugeChart,
      charts.HeatmapChart,
      components.GridComponent,
      components.TooltipComponent,
      components.LegendComponent,
      components.VisualMapComponent,
      renderers.CanvasRenderer,
    ]);

    return core;
  })();

  return loaded;
}
