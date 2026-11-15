import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BudgetingApiService, BudgetingDashboard, BudgetVersion, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, VERSION_STATUS_COLORS } from './budgeting.util';

/** Budget against actuals so far, the monthly series, the largest overruns and the versions waiting for approval. */
@Component({
  selector: 'app-budgeting-dashboard',
  styleUrl: './budgeting.scss',
  imports: [DecimalPipe, FormsModule, RouterLink, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzStatisticModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'BUDGETING.DASHBOARD_TITLE' | translate" [subtitle]="'BUDGETING.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 320px" nzAllowClear [ngModel]="versionId()" (ngModelChange)="selectVersion($event)" [nzPlaceHolder]="'BUDGETING.VERSION' | translate" [attr.aria-label]="'BUDGETING.VERSION' | translate">
        @for (version of versions(); track version.id) {
          <nz-option [nzValue]="version.id" [nzLabel]="version.fiscal_year + ' - ' + version.name"></nz-option>
        }
      </nz-select>
    </div>

    @if (dashboard(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'BUDGETING.VERSIONS_TOTAL' | translate" [nzValue]="data.versions.total"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'BUDGETING.STATUS_SUBMITTED' | translate" [nzValue]="data.versions.by_status.submitted"></nz-statistic></nz-card>
        @if (data.totals; as totals) {
          <nz-card><nz-statistic [nzTitle]="'BUDGETING.ANNUAL_BUDGET' | translate" [nzValue]="(totals.annual_budget | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'BUDGETING.BUDGET_TO_DATE' | translate" [nzValue]="(totals.budget | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'BUDGETING.ACTUAL_TO_DATE' | translate" [nzValue]="(totals.actual | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'BUDGETING.VARIANCE' | translate" [nzValue]="(totals.variance | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'BUDGETING.CONSUMPTION' | translate" [nzValue]="(totals.consumption_percent | number: '1.1-1') + '%'"></nz-statistic></nz-card>
        }
      </div>

      @if (data.selected_version; as selected) {
        <p class="muted">
          {{ 'BUDGETING.SELECTED_VERSION' | translate }}:
          <a [routerLink]="['/budgeting/versions', selected.id]">{{ selected.name }}</a>
          <nz-tag [nzColor]="statusColor(selected.status)">{{ ('BUDGETING.STATUS_' + selected.status.toUpperCase()) | translate }}</nz-tag>
          {{ 'BUDGETING.THROUGH_PERIOD' | translate }}: {{ data.through_period }}
        </p>
      }

      <nz-card class="main-card" [nzTitle]="'BUDGETING.MONTHLY_SERIES' | translate">
        <nz-table #seriesTable [nzData]="data.series" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.PERIOD' | translate }}</th>
              <th class="num">{{ 'BUDGETING.BUDGET' | translate }}</th>
              <th class="num">{{ 'BUDGETING.ACTUAL' | translate }}</th>
              <th class="num">{{ 'BUDGETING.CUMULATIVE_BUDGET' | translate }}</th>
              <th class="num">{{ 'BUDGETING.CUMULATIVE_ACTUAL' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of seriesTable.data; track row.period) {
              <tr>
                <td>{{ row.month }}</td>
                <td class="num">{{ row.budget | number: '1.2-2' }}</td>
                <td class="num">{{ row.actual !== null ? (row.actual | number: '1.2-2') : '' }}</td>
                <td class="num">{{ row.cumulative_budget | number: '1.2-2' }}</td>
                <td class="num">{{ row.cumulative_actual !== null ? (row.cumulative_actual | number: '1.2-2') : '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.series.length === 0) {
          <nz-empty [nzNotFoundContent]="'BUDGETING.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'BUDGETING.TOP_OVERRUNS' | translate">
        <nz-table #overrunTable [nzData]="data.top_overruns" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.ACCOUNT' | translate }}</th>
              <th class="num">{{ 'BUDGETING.BUDGET' | translate }}</th>
              <th class="num">{{ 'BUDGETING.ACTUAL' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE_PERCENT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of overrunTable.data; track row.key) {
              <tr>
                <td>{{ row.code }} <span class="muted">{{ row.label }}</span></td>
                <td class="num">{{ row.budget | number: '1.2-2' }}</td>
                <td class="num">{{ row.actual | number: '1.2-2' }}</td>
                <td class="num row-overdue">{{ row.variance | number: '1.2-2' }}</td>
                <td class="num">{{ row.variance_percent !== null ? (row.variance_percent | number: '1.1-1') + '%' : '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.top_overruns.length === 0) {
          <nz-empty [nzNotFoundContent]="'BUDGETING.NO_OVERRUNS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'BUDGETING.PENDING_APPROVAL' | translate">
        <nz-table #pendingTable [nzData]="data.pending_approval" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.NAME' | translate }}</th>
              <th>{{ 'BUDGETING.FISCAL_YEAR' | translate }}</th>
              <th>{{ 'BUDGETING.SUBMITTED_AT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of pendingTable.data; track row.id) {
              <tr>
                <td><a [routerLink]="['/budgeting/versions', row.id]">{{ row.name }}</a></td>
                <td>{{ row.fiscal_year }}</td>
                <td>{{ row.submitted_at }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.pending_approval.length === 0) {
          <nz-empty [nzNotFoundContent]="'BUDGETING.NO_PENDING_APPROVAL' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class BudgetingDashboardComponent implements OnInit {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly versions = signal<BudgetVersion[]>([]);
  readonly versionId = signal<string | null>(null);
  readonly dashboard = signal<BudgetingDashboard | null>(null);

  ngOnInit(): void {
    this.api.getVersions({ per_page: 100 }).subscribe({
      next: (response) => this.versions.set(response.data),
      error: () => this.versions.set([]),
    });
    this.load();
  }

  statusColor(status: string): string {
    return VERSION_STATUS_COLORS[status as keyof typeof VERSION_STATUS_COLORS] ?? 'default';
  }

  selectVersion(id: string | null): void {
    this.versionId.set(id);
    this.load();
  }

  load(): void {
    this.api.getDashboard(this.versionId() ?? undefined).subscribe({
      next: (response) => this.dashboard.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
