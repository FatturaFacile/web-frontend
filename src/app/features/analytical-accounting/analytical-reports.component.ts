import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { AnalyticalAccountingApiService, ContributionMarginStatement, ReportFilters } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AnalyticalAccountingStore } from './analytical-accounting.store';
import { statementIsConsistent } from './analytical-accounting.util';

interface StatementLine {
  key: string;
  value: string;
  pct: string | null;
  level: boolean;
  result: boolean;
}

/** Contribution margin income statement and the direct versus apportioned cost comparison, with hierarchy roll-up. */
@Component({
  selector: 'app-analytical-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './analytical-accounting.scss',
  imports: [FormsModule, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzInputModule, NzSelectModule, NzSwitchModule, NzTableModule],
  template: `
    <app-page-header
      [title]="'ANALYTICAL.REPORTS_TITLE' | translate"
      [subtitle]="'ANALYTICAL.REPORTS_SUBTITLE' | translate"
    ></app-page-header>

    <div class="toolbar">
      <input nz-input type="date" style="width: 160px" [ngModel]="from()" (ngModelChange)="from.set($event)" [attr.aria-label]="'ANALYTICAL.FROM' | translate" />
      <input nz-input type="date" style="width: 160px" [ngModel]="to()" (ngModelChange)="to.set($event)" [attr.aria-label]="'ANALYTICAL.TO' | translate" />
      <nz-select style="min-width: 200px" nzAllowClear [nzPlaceHolder]="'ANALYTICAL.COST_CENTER' | translate" [ngModel]="costCenterId()" (ngModelChange)="costCenterId.set($event ?? null)">
        @for (center of costCenters(); track center.id) {
          <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name"></nz-option>
        }
      </nz-select>
      <nz-select style="min-width: 200px" nzAllowClear [nzPlaceHolder]="'ANALYTICAL.PROFIT_CENTER' | translate" [ngModel]="profitCenterId()" (ngModelChange)="profitCenterId.set($event ?? null)">
        @for (center of profitCenters(); track center.id) {
          <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name"></nz-option>
        }
      </nz-select>
      <input nz-input style="width: 180px" [placeholder]="'ANALYTICAL.PROJECT' | translate" [ngModel]="projectId()" (ngModelChange)="projectId.set($event)" />
      <input nz-input style="width: 180px" [placeholder]="'ANALYTICAL.PRODUCT_LINE' | translate" [ngModel]="productLineId()" (ngModelChange)="productLineId.set($event)" />
      <label>
        <nz-switch [ngModel]="includeDescendants()" (ngModelChange)="includeDescendants.set($event)"></nz-switch>
        {{ 'ANALYTICAL.INCLUDE_DESCENDANTS' | translate }}
      </label>
      <button nz-button nzType="primary" [nzLoading]="store.loading()" (click)="load()">{{ 'ANALYTICAL.APPLY' | translate }}</button>
      <a nz-button [href]="exportHref('contribution-margin')" target="_blank" rel="noopener">{{ 'ANALYTICAL.EXPORT_CSV' | translate }}</a>
    </div>

    @if (store.error(); as error) {
      <p class="error" role="alert">{{ error | translate }}</p>
    }

    <nz-card [nzTitle]="'ANALYTICAL.CONTRIBUTION_MARGIN' | translate">
      @if (lines().length) {
        <div class="statement">
          @for (line of lines(); track line.key) {
            <div class="row" [class.level]="line.level" [class.result]="line.result">
              <span>{{ 'ANALYTICAL.LINE_' + line.key | translate }}</span>
              <span>
                <span class="num" [class.negative]="line.value.startsWith('-')">{{ line.value }}</span>
                @if (line.pct !== null) { <span class="pct">{{ line.pct }} %</span> }
              </span>
            </div>
          }
        </div>
        @if (!consistent()) {
          <p class="error" role="alert">{{ 'ANALYTICAL.STATEMENT_MISMATCH' | translate }}</p>
        }
      } @else {
        <p class="muted">{{ 'ANALYTICAL.NO_DATA' | translate }}</p>
      }
    </nz-card>

    <nz-card [nzTitle]="'ANALYTICAL.DIRECT_VS_APPORTIONED' | translate">
      <nz-table [nzData]="store.comparison()?.rows ?? []" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'ANALYTICAL.CODE' | translate }}</th>
            <th class="num">{{ 'ANALYTICAL.DIRECT_COST' | translate }}</th>
            <th class="num">{{ 'ANALYTICAL.APPORTIONED_IN' | translate }}</th>
            <th class="num">{{ 'ANALYTICAL.APPORTIONED_OUT' | translate }}</th>
            <th class="num">{{ 'ANALYTICAL.NET_COST' | translate }}</th>
            <th class="num">{{ 'ANALYTICAL.VARIANCE' | translate }}</th>
            <th class="num">{{ 'ANALYTICAL.SHARE_PCT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of store.comparison()?.rows ?? []; track row.center_id) {
            <tr>
              <td [style.padding-left.px]="12 + row.depth * 16"><strong>{{ row.code }}</strong> {{ row.name }}</td>
              <td class="num">{{ row.direct_cost }}</td>
              <td class="num">{{ row.apportioned_in }}</td>
              <td class="num">{{ row.apportioned_out }}</td>
              <td class="num">{{ row.net_cost }}</td>
              <td class="num" [class.negative]="row.variance.startsWith('-')">{{ row.variance }} ({{ row.variance_pct }} %)</td>
              <td class="num">{{ row.share_pct }} %</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class AnalyticalReportsComponent implements OnInit {
  protected readonly store = inject(AnalyticalAccountingStore);
  private readonly api = inject(AnalyticalAccountingApiService);

  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly costCenterId = signal<string | null>(null);
  protected readonly profitCenterId = signal<string | null>(null);
  protected readonly projectId = signal('');
  protected readonly productLineId = signal('');
  protected readonly includeDescendants = signal(true);

  protected readonly costCenters = computed(() => this.store.activeCenters().filter((c) => c.center_type === 'COST_CENTER'));
  protected readonly profitCenters = computed(() => this.store.activeCenters().filter((c) => c.center_type === 'PROFIT_CENTER'));

  protected readonly filters = computed<ReportFilters>(() => ({
    ...(this.from() ? { from: this.from() } : {}),
    ...(this.to() ? { to: this.to() } : {}),
    ...(this.costCenterId() ? { cost_center_id: this.costCenterId() as string } : {}),
    ...(this.profitCenterId() ? { profit_center_id: this.profitCenterId() as string } : {}),
    ...(this.projectId() ? { project_id: this.projectId() } : {}),
    ...(this.productLineId() ? { product_line_id: this.productLineId() } : {}),
    include_descendants: this.includeDescendants(),
  }));

  protected readonly consistent = computed(() => {
    const statement = this.store.margin()?.statement;
    return statement ? statementIsConsistent(statement) : true;
  });

  protected readonly lines = computed<StatementLine[]>(() => {
    const s: ContributionMarginStatement | undefined = this.store.margin()?.statement;
    if (!s) {
      return [];
    }
    const line = (key: string, value: string, pct: string | null = null, level = false, result = false): StatementLine => ({ key, value, pct, level, result });
    return [
      line('REVENUES', s.operating_revenues, null, true),
      line('VARIABLE_COSTS', s.direct_variable_costs),
      line('CM1', s.contribution_margin_1, s.contribution_margin_1_pct, true),
      line('FIXED_COSTS', s.direct_fixed_costs),
      line('CM2', s.contribution_margin_2, s.contribution_margin_2_pct, true),
      line('INDIRECT_COSTS', s.indirect_costs),
      line('APPORTIONED_COSTS', s.apportioned_costs),
      line('OPERATING_RESULT', s.operating_result, s.operating_result_pct, true, true),
    ];
  });

  ngOnInit(): void {
    void this.store.loadCenters();
    void this.load();
  }

  protected load(): Promise<void> {
    return this.store.loadReports(this.filters());
  }

  protected exportHref(report: 'contribution-margin' | 'direct-vs-apportioned'): string {
    return this.api.exportUrl(report, this.filters());
  }
}
