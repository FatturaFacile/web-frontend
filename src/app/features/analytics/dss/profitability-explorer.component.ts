import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DrillTarget,
  ProfitabilityDimension,
  ProfitabilityMatrixResponse,
  ProfitabilityMatrixRow,
  ReportingCurrency,
} from './dss.models';
import {
  dimensionEntityType,
  erodingRows,
  formatAmount,
  marginTone,
  whaleCurveOption,
} from './dss.utils';
import { DssChartComponent } from './dss-chart.component';

const DIMENSIONS: readonly ProfitabilityDimension[] = [
  'customer',
  'product',
  'channel',
  'cost_center',
  'legal_entity',
];

/**
 * Multi-dimensional profitability matrix with the Whale Curve: a switchable dimension, the Pareto 80/20 cut-off line and the
 * entities that erode the total profit highlighted. A row opens the drill-down where the ledger knows the dimension.
 */
@Component({
  selector: 'app-profitability-explorer',
  styleUrl: './dss.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    NzCardModule,
    NzSegmentedModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    DssChartComponent,
  ],
  template: `
    <nz-card [nzTitle]="'EXEC_DSS.PROFIT_TITLE' | translate" data-testid="profitability">
      <div class="toolbar">
        <nz-segmented
          data-testid="dimension-switcher"
          [nzOptions]="dimensionOptions()"
          [ngModel]="dimension()"
          (nzValueChange)="onDimension($event)"
        ></nz-segmented>
        @if (matrix(); as data) {
          <nz-tag data-testid="pareto-tag">{{
            'EXEC_DSS.PARETO_CORE'
              | translate: { count: data.pareto_cutoff_rank, total: data.entity_count }
          }}</nz-tag>
          @if (eroding().length > 0) {
            <nz-tag nzColor="error" data-testid="eroding-tag">{{
              'EXEC_DSS.ERODING' | translate: { count: eroding().length }
            }}</nz-tag>
          }
        }
      </div>

      <nz-spin [nzSpinning]="loading()">
        @if (matrix(); as data) {
          <app-dss-chart
            testId="whale-chart"
            [label]="'EXEC_DSS.WHALE_CURVE' | translate"
            [option]="whaleOption()"
          ></app-dss-chart>

          <nz-table
            #table
            nzSize="small"
            data-testid="matrix-table"
            [nzData]="data.rows"
            [nzPageSize]="10"
            [nzShowPagination]="data.rows.length > 10"
          >
            <thead>
              <tr>
                <th>{{ 'EXEC_DSS.COL_ENTITY' | translate }}</th>
                <th class="right">{{ 'EXEC_DSS.COL_NET_REVENUE' | translate }}</th>
                <th class="right">{{ 'EXEC_DSS.COL_GROSS_MARGIN' | translate }}</th>
                <th class="right">{{ 'EXEC_DSS.COL_CM1' | translate }}</th>
                <th class="right">{{ 'EXEC_DSS.COL_CM2' | translate }}</th>
                <th class="right">{{ 'EXEC_DSS.COL_EBITDA' | translate }}</th>
                <th class="right">{{ 'EXEC_DSS.COL_NET_PROFIT' | translate }}</th>
                <th class="right">{{ 'EXEC_DSS.COL_MARGIN_PCT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of table.data; track row.key) {
                <tr
                  [class.eroding]="row.is_value_destroying"
                  [attr.data-testid]="'matrix-row-' + row.key"
                  [style.cursor]="drillable() ? 'pointer' : 'default'"
                  (click)="open(row)"
                >
                  <td>
                    {{ row.label }}
                    @if (row.in_pareto_core) {
                      <nz-tag nzColor="gold">80/20</nz-tag>
                    }
                  </td>
                  <td class="right">{{ money(row.net_revenue) }}</td>
                  <td class="right">{{ money(row.gross_margin) }}</td>
                  <td class="right">{{ money(row.contribution_margin_1) }}</td>
                  <td class="right">{{ money(row.contribution_margin_2) }}</td>
                  <td class="right">{{ money(row.ebitda) }}</td>
                  <td
                    class="right"
                    [class]="'right ' + (row.net_operating_profit < 0 ? 'margin-negative' : '')"
                  >
                    {{ money(row.net_operating_profit) }}
                  </td>
                  <td class="right" [class]="'right margin-' + tone(row)">
                    {{ row.net_margin_pct | number: '1.1-1' }}%
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        } @else {
          <p class="muted">{{ 'EXEC_DSS.EMPTY' | translate }}</p>
        }
      </nz-spin>
    </nz-card>
  `,
})
export class ProfitabilityExplorerComponent {
  private readonly i18n = inject(TranslateService);

  readonly matrix = input.required<ProfitabilityMatrixResponse | null>();
  readonly dimension = input.required<ProfitabilityDimension>();
  readonly currency = input.required<ReportingCurrency>();
  readonly loading = input(false);
  readonly dimensionChange = output<ProfitabilityDimension>();
  /** The user opened a row. */
  readonly drill = output<DrillTarget>();

  protected readonly dimensionOptions = computed(() =>
    DIMENSIONS.map((value) => ({
      label: this.i18n.instant(`EXEC_DSS.DIM_${value.toUpperCase()}`),
      value,
    })),
  );
  protected readonly eroding = computed(() => erodingRows(this.matrix()?.rows ?? []));
  protected readonly drillable = computed(() => dimensionEntityType(this.dimension()) !== null);

  protected readonly whaleOption = computed(() => {
    const data = this.matrix();

    return data === null || data.whale_curve.length === 0
      ? null
      : whaleCurveOption(data.whale_curve, data.pareto_cutoff_rank, {
          profit: this.i18n.instant('EXEC_DSS.COL_NET_PROFIT'),
          pareto: this.i18n.instant('EXEC_DSS.PARETO_LINE'),
          total: this.i18n.instant('EXEC_DSS.WHALE_TOTAL'),
          format: (value) => this.money(value),
        });
  });

  protected money(value: number): string {
    return formatAmount(value, this.currency(), this.i18n.currentLanguage());
  }

  protected tone(row: ProfitabilityMatrixRow): string {
    return marginTone(row.net_margin_pct);
  }

  protected onDimension(value: string | number): void {
    this.dimensionChange.emit(String(value) as ProfitabilityDimension);
  }

  protected open(row: ProfitabilityMatrixRow): void {
    const entityType = dimensionEntityType(this.dimension());

    // The records without an entity (key '') stay out: the ledger has no filter for "unassigned".
    if (entityType !== null && row.key !== '') {
      this.drill.emit({ metric: 'revenue', entityType, entityId: row.key, label: row.label });
    }
  }
}
