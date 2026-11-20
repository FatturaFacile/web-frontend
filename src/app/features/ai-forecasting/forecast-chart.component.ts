import { Component, DestroyRef, effect, ElementRef, inject, input, viewChild } from '@angular/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

/**
 * Draws an ECharts option. ECharts is loaded the first time a chart is shown, so it stays out of the initial bundle, and
 * the chart follows the size of its container.
 */
@Component({
  selector: 'app-forecast-chart',
  template: `<div
    #host
    class="chart"
    role="img"
    [attr.aria-label]="label()"
    [attr.data-testid]="testId()"
  ></div>`,
  styles: [':host{display:block}.chart{width:100%;height:var(--forecast-chart-height,380px)}'],
})
export class ForecastChartComponent {
  readonly option = input.required<EChartsCoreOption | null>();
  /** Accessible description of the chart. */
  readonly label = input<string>('');
  readonly testId = input<string>('forecast-chart');

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

/** Registers only the charts and components the forecasting views use. */
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
      components.GridComponent,
      components.TooltipComponent,
      components.LegendComponent,
      components.MarkPointComponent,
      components.MarkLineComponent,
      renderers.CanvasRenderer,
    ]);

    return core;
  })();

  return loaded;
}
