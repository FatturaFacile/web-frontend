import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  PermissionsService,
  ProjectClosureChecks,
  ProjectControlApiService,
  ProjectGantt,
  ProjectProfitability,
} from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

/** Profitability, forecast, closure checks and schedule (Gantt, critical path, baseline) of a project. */
@Component({
  selector: 'app-pc-analysis',
  styleUrl: './pc-analysis.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    NzAlertModule, NzButtonModule, NzCardModule, NzDescriptionsModule, NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    @if (closure(); as checks) {
      <nz-alert
        class="mb-4"
        nzShowIcon
        [nzType]="checks.can_close ? 'success' : 'warning'"
        [nzMessage]="(checks.can_close ? 'PRJ.CAN_CLOSE' : 'PRJ.CANNOT_CLOSE') | translate"
        [nzDescription]="issues"
      />
      <ng-template #issues>
        @for (blocker of checks.blockers; track blocker.code) {
          <div>{{ blocker.message }}</div>
        }
        @for (warning of checks.warnings; track warning.code) {
          <div>{{ warning.message }} <nz-tag nzColor="gold">{{ 'PRJ.WARNING' | translate }}</nz-tag></div>
        }
      </ng-template>
    }

    @if (profit(); as p) {
      <nz-card [nzTitle]="'PRJ.PROFITABILITY' | translate" nzSize="small" class="mb-4">
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 3 }">
          <nz-descriptions-item [nzTitle]="'PRJ.CONTRACT_VALUE' | translate">{{ p.contract_value | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.BUDGET_REVENUE' | translate">{{ p.budget.revenue | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.BUDGET_COST' | translate">{{ p.budget.cost | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.REVENUE_BILLED' | translate">{{ p.revenue.billed | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.REVENUE_RECOGNISED' | translate">{{ p.revenue.recognised | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.UNBILLED_TM' | translate">{{ p.revenue.unbilled_time_and_materials | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.COST_ACTUAL' | translate">{{ p.cost.actual | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.COMMITTED' | translate">{{ p.cost.committed | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.GROSS_MARGIN' | translate">{{ p.margin.gross_margin | money: p.currency }} ({{ p.margin.gross_margin_percentage ?? '-' }}%)</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.ESTIMATE_AT_COMPLETION' | translate">{{ p.forecast.estimate_at_completion | money: p.currency }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.FORECAST_MARGIN' | translate">
            {{ p.forecast.forecast_margin | money: p.currency }}
            @if (p.forecast.is_loss_forecast) {
              <nz-tag nzColor="red">{{ 'PRJ.LOSS_FORECAST' | translate }}</nz-tag>
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'PRJ.HOURS_BILLABLE' | translate">{{ p.hours.billable }} / {{ p.hours.approved }}</nz-descriptions-item>
        </nz-descriptions>
      </nz-card>
    }

    @if (gantt(); as g) {
      <nz-card [nzTitle]="'PRJ.SCHEDULE' | translate" nzSize="small">
        @if (canWrite) {
          <button nz-button type="button" class="mb-3" (click)="freezeBaseline()">{{ 'PRJ.SCHEDULE_BASELINE' | translate }}</button>
        }
        <p>{{ 'PRJ.SCHEDULE_FINISH' | translate }}: {{ g.schedule_finish ?? '-' }} - {{ 'PRJ.PROGRESS' | translate }}: {{ g.progress_percentage }}%</p>
        <nz-table #ganttTable nzSize="small" [nzData]="g.tasks" [nzPageSize]="20">
          <thead>
            <tr>
              <th>WBS</th>
              <th [nzSortFn]="'title' | gridSort" [nzFilters]="'title' | gridFilterList: ganttTable.nzData" [nzFilterFn]="'title' | gridFilterFn">{{ 'PRJ.TITLE' | translate }}</th>
              <th [nzSortFn]="'planned_start_date' | gridSort" [nzFilters]="'planned_start_date' | gridFilterList: ganttTable.nzData" [nzFilterFn]="'planned_start_date' | gridFilterFn">{{ 'PRJ.PLANNED' | translate }}</th>
              <th>{{ 'PRJ.BASELINE' | translate }}</th>
              <th nzAlign="right">{{ 'PRJ.FINISH_VARIANCE' | translate }}</th>
              <th>{{ 'PRJ.CRITICAL_PATH' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (task of ganttTable.data; track task.id) {
              <tr>
                <td>{{ task.wbs_code ?? task.task_number }}</td>
                <td>{{ task.title }}</td>
                <td>{{ task.planned_start_date }} / {{ task.planned_end_date }}</td>
                <td>{{ task.baseline_start_date ?? '' }} / {{ task.baseline_end_date ?? '' }}</td>
                <td nzAlign="right">{{ task.finish_variance_days ?? '' }}</td>
                <td>
                  @if (criticalIds().has(task.id)) {
                    <nz-tag nzColor="red">{{ 'PRJ.CRITICAL' | translate }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class PcAnalysisComponent implements OnInit {
  readonly projectId = input.required<string>();

  private readonly api = inject(ProjectControlApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly profit = signal<ProjectProfitability | null>(null);
  protected readonly closure = signal<ProjectClosureChecks | null>(null);
  protected readonly gantt = signal<ProjectGantt | null>(null);
  protected readonly criticalIds = computed(() => new Set(this.gantt()?.critical_path ?? []));

  ngOnInit(): void {
    this.load();
  }

  protected freezeBaseline(): void {
    this.api.baselineSchedule(this.projectId()).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('PRJ.SCHEDULE_BASELINE_DONE'));
        this.load();
      },
    });
  }

  private load(): void {
    const id = this.projectId();
    this.api.getProfitability(id).subscribe({ next: (res) => this.profit.set(res.data) });
    this.api.getClosureChecks(id).subscribe({ next: (res) => this.closure.set(res.data) });
    this.api.getGantt(id).subscribe({ next: (res) => this.gantt.set(res.data) });
  }
}
