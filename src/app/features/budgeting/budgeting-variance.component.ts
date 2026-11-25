import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BUDGET_VARIANCE_GROUPS, BudgetDimensionFilters, BudgetingApiService, BudgetVariance, BudgetVarianceGroup, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { BarGroup, BudgetingBarsComponent } from './budgeting-bars.component';
import { BudgetingDimensionsComponent } from './budgeting-dimensions.component';
import { apiErrorText, blankToNull, OPTIONAL_UUID_PATTERN, TRAFFIC_LIGHT_COLORS } from './budgeting.util';

/** Budget versus actual of a version: the actuals come from the general ledger. Traffic lights, filters and a chart. */
@Component({
  selector: 'app-budgeting-variance',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    BudgetingBarsComponent,
    BudgetingDimensionsComponent,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <div class="toolbar">
      <nz-select style="width: 220px" [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event); load()" [attr.aria-label]="'BUDGETING.GROUP_BY' | translate">
        @for (value of groups; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.GROUP_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 220px" [ngModel]="throughPeriod()" (ngModelChange)="throughPeriod.set($event); load()" [attr.aria-label]="'BUDGETING.THROUGH_PERIOD' | translate">
        @for (period of periods; track period) {
          <nz-option [nzValue]="period" [nzLabel]="('BUDGETING.THROUGH_PERIOD_N' | translate: { period: period })"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card" [nzTitle]="'BUDGETING_CONTROL.FILTERS' | translate">
      <div class="form-row">
        <app-budgeting-dimensions [group]="filterForm" />
      </div>
      <button nz-button (click)="applyFilters()" [disabled]="filterForm.invalid">{{ 'BUDGETING_CONTROL.APPLY_FILTERS' | translate }}</button>
      <button nz-button nzType="text" (click)="clearFilters()">{{ 'BUDGETING_CONTROL.CLEAR_FILTERS' | translate }}</button>
    </nz-card>

    @if (variance(); as data) {
      <div class="stats-grid">
        <nz-card>{{ 'BUDGETING.BUDGET' | translate }}: <strong>{{ data.totals.budget | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.ACTUAL' | translate }}: <strong>{{ data.totals.actual | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.VARIANCE' | translate }}: <strong>{{ data.totals.variance | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.ADVERSE' | translate }}: <strong class="row-overdue">{{ data.totals.adverse | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.FAVORABLE' | translate }}: <strong class="row-ok">{{ data.totals.favorable | number: '1.2-2' }}</strong></nz-card>
      </div>

      @if (data.thresholds; as thresholds) {
        <p class="muted">{{ 'BUDGETING_CONTROL.TRAFFIC_LEGEND' | translate: { amber: thresholds.amber, red: thresholds.red } }}</p>
      }

      @if (bars().length > 0) {
        <nz-card class="main-card" [nzTitle]="'BUDGETING_CONTROL.CHART_TITLE' | translate">
          <app-budgeting-bars [groups]="bars()" />
        </nz-card>
      }

      <nz-card class="main-card">
        <nz-table #table [nzData]="data.rows" nzSize="small" [nzPageSize]="50">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.GROUP_' + data.group_by.toUpperCase() | translate }}</th>
              <th class="num">{{ 'BUDGETING.BUDGET' | translate }}</th>
              <th class="num">{{ 'BUDGETING.ACTUAL' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE_PERCENT' | translate }}</th>
              <th></th>
              <th>{{ 'BUDGETING_CONTROL.TRAFFIC_LIGHT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.key) {
              <tr>
                <td>{{ row.code }} <span class="muted">{{ row.label }}</span></td>
                <td class="num">{{ row.budget | number: '1.2-2' }}</td>
                <td class="num">{{ row.actual | number: '1.2-2' }}</td>
                <td class="num" [class.row-overdue]="!row.is_favorable" [class.row-ok]="row.is_favorable && row.status !== 'on_budget'">{{ row.variance | number: '1.2-2' }}</td>
                <td class="num">{{ row.variance_percent !== null ? (row.variance_percent | number: '1.1-1') + '%' : '' }}</td>
                <td><nz-tag [nzColor]="row.status === 'on_budget' ? 'default' : row.is_favorable ? 'green' : 'red'">{{ ('BUDGETING.VARIANCE_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                <td>
                  @if (row.traffic_light) {
                    <nz-tag [nzColor]="lightColor(row.traffic_light)">{{ ('BUDGETING_CONTROL.LIGHT_' + row.traffic_light.toUpperCase()) | translate }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.rows.length === 0) {
          <nz-empty [nzNotFoundContent]="'BUDGETING.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class BudgetingVarianceComponent {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly versionId = input.required<string>();
  /** Bumped by the parent when the lines changed. */
  readonly refresh = input(0);

  readonly groups = BUDGET_VARIANCE_GROUPS;
  readonly periods = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly groupBy = signal<BudgetVarianceGroup>('account');
  readonly throughPeriod = signal(12);
  readonly variance = signal<BudgetVariance | null>(null);
  readonly filters = signal<BudgetDimensionFilters>({});

  readonly filterForm = this.fb.group({
    account_id: this.fb.control<string | null>(null),
    cost_center_id: this.fb.control<string | null>(null),
    project_id: ['', [Validators.pattern(OPTIONAL_UUID_PATTERN)]],
  });

  readonly bars = computed<BarGroup[]>(() =>
    (this.variance()?.rows ?? []).slice(0, 12).map((row) => ({ label: `${row.code ?? ''} ${row.label}`.trim(), budget: row.budget, actual: row.actual, favorable: row.is_favorable })),
  );

  constructor() {
    effect(() => {
      this.versionId();
      this.refresh();
      this.load();
    });
  }

  lightColor(light: 'green' | 'amber' | 'red'): string {
    return TRAFFIC_LIGHT_COLORS[light];
  }

  applyFilters(): void {
    const value = this.filterForm.getRawValue();
    this.filters.set({ account_id: value.account_id, cost_center_id: value.cost_center_id, project_id: blankToNull(value.project_id) });
    this.load();
  }

  clearFilters(): void {
    this.filterForm.reset({ account_id: null, cost_center_id: null, project_id: '' });
    this.filters.set({});
    this.load();
  }

  load(): void {
    this.api.getVariance(this.versionId(), this.throughPeriod(), this.groupBy(), this.filters()).subscribe({
      next: (response) => this.variance.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
