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
import { PlanningApiService, PlanningDashboard, PlanningScenario, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, monthLabel, SCENARIO_STATUS_COLORS } from './planning.util';

/** Scenarios per status, the current plan, the biggest supply gaps and the load of every resource. */
@Component({
  selector: 'app-planning-dashboard',
  styleUrl: './planning.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PLANNING.DASHBOARD_TITLE' | translate" [subtitle]="'PLANNING.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 320px" nzAllowClear [ngModel]="scenarioId()" (ngModelChange)="selectScenario($event)" [attr.aria-label]="'PLANNING.SCENARIO' | translate" [nzPlaceHolder]="'PLANNING.SCENARIO' | translate">
        @for (scenario of scenarios(); track scenario.id) {
          <nz-option [nzValue]="scenario.id" [nzLabel]="scenario.name"></nz-option>
        }
      </nz-select>
    </div>

    @if (dashboard(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'PLANNING.SCENARIOS_TOTAL' | translate" [nzValue]="data.scenarios.total"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'PLANNING.STATUS_REVIEW' | translate" [nzValue]="data.scenarios.by_status.review"></nz-statistic></nz-card>
        <nz-card>
          <nz-statistic [nzTitle]="'PLANNING.CURRENT_PLAN' | translate" [nzValue]="data.current_publication ? 'v' + data.current_publication.version : '-'"></nz-statistic>
        </nz-card>
        @if (data.totals; as totals) {
          <nz-card><nz-statistic [nzTitle]="'PLANNING.TOTAL_DEMAND' | translate" [nzValue]="(totals.total_demand | number: '1.0-3') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'PLANNING.TOTAL_SUPPLY' | translate" [nzValue]="(totals.total_supply | number: '1.0-3') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'PLANNING.TOTAL_GAP' | translate" [nzValue]="(totals.total_gap | number: '1.0-3') ?? ''"></nz-statistic></nz-card>
        }
        <nz-card><nz-statistic [nzTitle]="'PLANNING.OVERLOADED_MONTHS' | translate" [nzValue]="data.capacity.summary.overloaded_count"></nz-statistic></nz-card>
      </div>

      @if (data.selected_scenario; as selected) {
        <p class="muted">
          {{ 'PLANNING.SELECTED_SCENARIO' | translate }}:
          <a [routerLink]="['/planning/scenarios', selected.id]">{{ selected.name }}</a>
          <nz-tag [nzColor]="statusColor(selected.status)">{{ ('PLANNING.STATUS_' + selected.status.toUpperCase()) | translate }}</nz-tag>
        </p>
      }

      <nz-card class="main-card" [nzTitle]="'PLANNING.PENDING_APPROVAL' | translate">
        <nz-table #pendingTable [nzData]="data.pending_approval" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLANNING.NAME' | translate }}</th>
              <th>{{ 'PLANNING.SUBMITTED_AT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of pendingTable.data; track row.id) {
              <tr>
                <td><a [routerLink]="['/planning/scenarios', row.id]">{{ row.name }}</a></td>
                <td>{{ row.submitted_at }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.pending_approval.length === 0) {
          <nz-empty [nzNotFoundContent]="'PLANNING.NO_PENDING_APPROVAL' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLANNING.TOP_GAPS' | translate">
        <nz-table #gapTable [nzData]="data.top_gaps" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLANNING.ITEM' | translate }}</th>
              <th class="num">{{ 'PLANNING.TOTAL_GAP' | translate }}</th>
              <th class="num">{{ 'PLANNING.ENDING_GAP' | translate }}</th>
              <th class="num">{{ 'PLANNING.MAX_SHORTAGE' | translate }}</th>
              <th class="num">{{ 'PLANNING.SHORTAGE_PERIODS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of gapTable.data; track row.item_code) {
              <tr>
                <td>{{ row.item_code }} <span class="muted">{{ row.item_name }}</span></td>
                <td class="num">{{ row.total_gap | number: '1.0-3' }}</td>
                <td class="num">{{ row.ending_gap | number: '1.0-3' }}</td>
                <td class="num row-overdue">{{ row.max_shortage | number: '1.0-3' }}</td>
                <td class="num">{{ row.shortage_periods }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.top_gaps.length === 0) {
          <nz-empty [nzNotFoundContent]="'PLANNING.NO_GAPS' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLANNING.CAPACITY_LOAD' | translate">
        <nz-table #loadTable [nzData]="data.capacity.resources" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLANNING.RESOURCE' | translate }}</th>
              <th class="num">{{ 'PLANNING.PEAK_UTILIZATION' | translate }}</th>
              <th class="num">{{ 'PLANNING.OVERLOADED_MONTHS' | translate }}</th>
              <th>{{ 'PLANNING.UTILIZATION_BY_MONTH' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of loadTable.data; track row.resource_id) {
              <tr>
                <td>{{ row.resource_code }} <span class="muted">{{ row.resource_name }}</span></td>
                <td class="num" [class.row-overdue]="row.overloaded_periods > 0">{{ row.peak_utilization_percent !== null ? (row.peak_utilization_percent | number: '1.1-1') + '%' : '' }}</td>
                <td class="num">{{ row.overloaded_periods }}</td>
                <td>
                  @for (period of row.periods; track period.period) {
                    <nz-tag [nzColor]="period.is_overloaded ? 'red' : 'default'">{{ monthLabel(period.period) }}: {{ period.utilization_percent !== null ? (period.utilization_percent | number: '1.0-0') + '%' : '-' }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.capacity.resources.length === 0) {
          <nz-empty [nzNotFoundContent]="'PLANNING.NO_CAPACITY_DATA' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class PlanningDashboardComponent implements OnInit {
  private readonly api = inject(PlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly scenarios = signal<PlanningScenario[]>([]);
  readonly scenarioId = signal<string | null>(null);
  readonly dashboard = signal<PlanningDashboard | null>(null);
  readonly monthLabel = monthLabel;

  ngOnInit(): void {
    this.api.getScenarios({ per_page: 100 }).subscribe({
      next: (response) => this.scenarios.set(response.data),
      error: () => this.scenarios.set([]),
    });
    this.load();
  }

  statusColor(status: string): string {
    return SCENARIO_STATUS_COLORS[status as keyof typeof SCENARIO_STATUS_COLORS] ?? 'default';
  }

  selectScenario(id: string | null): void {
    this.scenarioId.set(id);
    this.load();
  }

  load(): void {
    this.api.getDashboard(this.scenarioId() ?? undefined).subscribe({
      next: (response) => this.dashboard.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
