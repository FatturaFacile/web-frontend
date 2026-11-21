import { Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@core';
import { resolveLocale } from '../../core/i18n/locale.utils';
import { UiPreferencesService } from '../../core/theme/ui-preferences.service';
import { TranslatePipe } from '@shared';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ChartClick, KpiChartComponent } from './kpi-chart.component';
import { chartOption } from './kpi-chart-options';
import { CockpitWidget, DisplayCurrency, DrillSegment } from './kpi-dashboards.models';
import {
  formatValue,
  isImprovement,
  kpiDescriptionKey,
  kpiTitleKey,
  segmentFor,
  segmentForRow,
  topRows,
  trendOf,
  unitOf,
} from './kpi-dashboards.utils';

/**
 * One KPI card. The headline value, its comparison badge and the visualization of the widget type; a click on the card or on
 * any chart element reports the segment so the page opens the drill-down drawer on it.
 */
@Component({
  selector: 'app-kpi-widget',
  imports: [TranslatePipe, KpiChartComponent, NzIconModule, NzTagModule],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .kpi-card {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 16px;
        border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
        border-radius: 8px;
        background: var(--ant-color-bg-container, #fff);
      }
      .kpi-card__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .kpi-card__title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }
      .kpi-card__desc {
        margin: 0;
        font-size: 12px;
        color: var(--ant-color-text-secondary, #595959);
      }
      .kpi-card__value {
        font-size: 28px;
        font-weight: 600;
        line-height: 1.2;
        cursor: pointer;
        background: none;
        border: 0;
        padding: 0;
        text-align: left;
        color: inherit;
      }
      .kpi-card__delta--good {
        color: #389e0d;
      }
      .kpi-card__delta--bad {
        color: #cf1322;
      }
      .kpi-card__table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .kpi-card__table th,
      .kpi-card__table td {
        padding: 4px 6px;
        text-align: left;
      }
      .kpi-card__table tbody tr {
        cursor: pointer;
      }
      .kpi-card__table tbody tr:hover {
        background: var(--ant-color-fill-quaternary, #fafafa);
      }
      .kpi-card__table .num {
        text-align: right;
      }
    `,
  ],
  template: `
    <article
      class="kpi-card"
      [attr.data-testid]="'kpi-widget-' + widget().kpi_code"
      [attr.aria-label]="title()"
    >
      <header class="kpi-card__head">
        <div>
          <h3 class="kpi-card__title">{{ titleKey() | translate }}</h3>
          <p class="kpi-card__desc">{{ descriptionKey() | translate }}</p>
        </div>
        @for (alert of widget().alerts; track alert.severity) {
          <nz-tag
            [nzColor]="alert.severity === 'critical' ? 'red' : 'orange'"
            data-testid="kpi-alert"
          >
            {{
              (alert.severity === 'critical'
                ? 'KPI_DASHBOARDS.SEVERITY_CRITICAL'
                : 'KPI_DASHBOARDS.SEVERITY_WARNING'
              ) | translate
            }}
          </nz-tag>
        }
      </header>

      @if (widget().widget_type === 'top_n_table') {
        <table class="kpi-card__table" data-testid="kpi-top-table">
          <thead>
            <tr>
              <th scope="col">{{ 'KPI_DASHBOARDS.COL_NAME' | translate }}</th>
              <th scope="col" class="num">{{ 'KPI_DASHBOARDS.COL_REVENUE' | translate }}</th>
              <th scope="col" class="num">{{ 'KPI_DASHBOARDS.COL_MARGIN' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr tabindex="0" (click)="drillRow(row.id)" (keydown.enter)="drillRow(row.id)">
                <td>{{ row.name }}</td>
                <td class="num">{{ money(row.revenue) }}</td>
                <td class="num">{{ percent(row.margin_percent) }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <button
          type="button"
          class="kpi-card__value"
          (click)="drill.emit({})"
          data-testid="kpi-value"
        >
          {{ formatted() }}
        </button>

        @if (widget().comparison.delta !== null) {
          <div
            class="kpi-card__delta"
            [class.kpi-card__delta--good]="improvement() === true"
            [class.kpi-card__delta--bad]="improvement() === false"
            data-testid="kpi-delta"
          >
            <span nz-icon [nzType]="trendIcon()" aria-hidden="true"></span>
            {{ deltaText() }}
            <span>{{
              'KPI_DASHBOARDS.COMPARE_' + widget().comparison.mode.toUpperCase() | translate
            }}</span>
          </div>
        }

        @if (option() !== null) {
          <app-kpi-chart
            [option]="option()"
            [label]="title()"
            [testId]="'kpi-chart-' + widget().kpi_code"
            (chartClick)="onChartClick($event)"
          />
        }
      }
    </article>
  `,
})
export class KpiWidgetComponent {
  readonly widget = input.required<CockpitWidget>();
  readonly currency = input.required<DisplayCurrency>();
  /** The segment the user clicked, to open the drill-down drawer on. */
  readonly drill = output<DrillSegment>();

  private readonly i18n = inject(TranslateService);
  private readonly preferences = inject(UiPreferencesService);

  protected readonly titleKey = computed(() => kpiTitleKey(this.widget().kpi_code));
  protected readonly descriptionKey = computed(() => kpiDescriptionKey(this.widget().kpi_code));
  protected readonly title = computed(() => {
    this.i18n.currentLanguage();

    return this.i18n.translate(this.titleKey());
  });
  private readonly locale = computed(() =>
    resolveLocale(this.i18n.currentLanguage(), this.currency()),
  );
  protected readonly rows = computed(() => topRows(this.widget()));
  protected readonly formatted = computed(() => this.format(this.widget().value));
  protected readonly improvement = computed(() =>
    isImprovement(this.widget().kpi_code, this.widget().comparison.delta),
  );
  protected readonly trendIcon = computed(() => {
    const trend = trendOf(this.widget().comparison.delta);

    return trend === 'up' ? 'arrow-up' : trend === 'down' ? 'arrow-down' : 'minus';
  });
  protected readonly deltaText = computed(() => {
    const comparison = this.widget().comparison;
    const percent = comparison.delta_percent;

    return percent === null
      ? this.format(comparison.delta)
      : `${percent > 0 ? '+' : ''}${percent} %`;
  });

  protected readonly option = computed(() => {
    // The language is read so labels follow a language switch; the theme so the chart text stays readable.
    this.i18n.currentLanguage();

    return chartOption(this.widget(), {
      t: (key) => this.i18n.translate(key),
      format: (value) => this.format(value),
      dark: this.preferences.resolvedTheme() === 'dark',
    });
  });

  protected money(value: number): string {
    return formatValue(value, 'currency', this.currency(), this.locale());
  }

  protected percent(value: number | null): string {
    return formatValue(value, 'percent', this.currency(), this.locale());
  }

  protected onChartClick(click: ChartClick): void {
    this.drill.emit(segmentFor(this.widget(), click));
  }

  protected drillRow(id: string): void {
    this.drill.emit(segmentForRow(this.widget(), id));
  }

  private format(value: number | null): string {
    return formatValue(value, unitOf(this.widget()), this.currency(), this.locale());
  }
}
