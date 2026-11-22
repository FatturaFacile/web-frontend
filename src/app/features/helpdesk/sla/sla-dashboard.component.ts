import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BreachRiskTarget, HelpdeskMetricsGroup, MetricsGroupBy } from '@core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';
import { BreachRiskStore } from './breach-risk.store';
import { SlaCountdownComponent } from './sla-countdown.component';
import { riskColor, riskLevel, TARGET_LABEL_KEYS } from './sla-countdown';

const RISK_THRESHOLDS = [50, 75, 90, 100] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const STATUSES = ['new', 'open', 'pending_customer', 'on_hold'] as const;
const GROUPINGS: readonly MetricsGroupBy[] = ['queue', 'priority', 'contract'];

/**
 * SLA command view of the agent workbench: the queue of tickets about to breach (live countdown, breach badges, priority
 * status and queue filters) and the SLA metrics (first response and resolution times, compliance, CSAT).
 */
@Component({
  selector: 'app-sla-dashboard',
  providers: [BreachRiskStore],
  imports: [
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    SlaCountdownComponent,
    TranslatePipe,
  ],
  template: `
    <nz-tabs (nzSelectedIndexChange)="onTab($event)">
      <nz-tab [nzTitle]="'HELPDESK_SLA.TAB_BREACH_RISK' | translate">
        <div class="sla-filters">
          <nz-select
            class="sla-filter"
            [ngModel]="store.riskPercent()"
            (ngModelChange)="changeThreshold($event)"
            [attr.aria-label]="'HELPDESK_SLA.FILTER_RISK' | translate"
          >
            @for (threshold of thresholds; track threshold) {
              <nz-option
                [nzValue]="threshold"
                [nzLabel]="'HELPDESK_SLA.RISK_FROM' | translate: { percent: threshold }"
              />
            }
          </nz-select>
          <nz-select
            class="sla-filter"
            nzAllowClear
            [ngModel]="store.priorityFilter() || null"
            (ngModelChange)="store.setFilters({ priorityFilter: $event ?? '' })"
            [nzPlaceHolder]="'HELPDESK_SLA.FILTER_PRIORITY' | translate"
            [attr.aria-label]="'HELPDESK_SLA.FILTER_PRIORITY' | translate"
          >
            @for (priority of priorities; track priority) {
              <nz-option
                [nzValue]="priority"
                [nzLabel]="'HELPDESK_SLA.PRIORITY_' + priority.toUpperCase() | translate"
              />
            }
          </nz-select>
          <nz-select
            class="sla-filter"
            nzAllowClear
            [ngModel]="store.statusFilter() || null"
            (ngModelChange)="store.setFilters({ statusFilter: $event ?? '' })"
            [nzPlaceHolder]="'HELPDESK_SLA.FILTER_STATUS' | translate"
            [attr.aria-label]="'HELPDESK_SLA.FILTER_STATUS' | translate"
          >
            @for (status of statuses; track status) {
              <nz-option
                [nzValue]="status"
                [nzLabel]="'HELPDESK_SLA.STATUS_' + status.toUpperCase() | translate"
              />
            }
          </nz-select>
          <nz-select
            class="sla-filter"
            nzAllowClear
            [ngModel]="store.queueFilter() || null"
            (ngModelChange)="store.setFilters({ queueFilter: $event ?? '' })"
            [nzPlaceHolder]="'HELPDESK_SLA.FILTER_QUEUE' | translate"
            [attr.aria-label]="'HELPDESK_SLA.FILTER_QUEUE' | translate"
          >
            @for (queue of store.queues(); track queue) {
              <nz-option [nzValue]="queue" [nzLabel]="queue.substring(0, 8)" />
            }
          </nz-select>
          <button nz-button type="button" (click)="reload()" [nzLoading]="store.loading()">
            {{ 'HELPDESK_SLA.REFRESH' | translate }}
          </button>
          @if (store.breachedCount() > 0) {
            <nz-tag nzColor="error" data-testid="breached-count">
              {{ 'HELPDESK_SLA.BREACHED_COUNT' | translate: { count: store.breachedCount() } }}
            </nz-tag>
          }
        </div>

        @if (store.failed()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'HELPDESK_SLA.LOAD_ERROR' | translate" />
        }

        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #risk
            [nzData]="store.visible()"
            nzSize="small"
            [nzShowPagination]="false"
            [nzPageSize]="100"
          >
            <thead>
              <tr>
                <th>{{ 'HELPDESK_SLA.COL_TICKET' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_PRIORITY' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_RISK' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_TARGETS' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (ticket of risk.data; track ticket.ticket_id) {
                <tr [class.sla-row-breached]="isBreached(ticket.targets)">
                  <td>
                    <strong>#{{ ticket.ticket_number }}</strong>
                    <div class="sla-subject">{{ ticket.subject }}</div>
                  </td>
                  <td>
                    <nz-tag [nzColor]="priorityColor(ticket.priority)">
                      {{ 'HELPDESK_SLA.PRIORITY_' + ticket.priority.toUpperCase() | translate }}
                    </nz-tag>
                  </td>
                  <td>
                    <nz-tag [nzColor]="colorOf(ticket.risk_percent)"
                      >{{ ticket.risk_percent }}%</nz-tag
                    >
                  </td>
                  <td>
                    @for (target of ticket.targets; track target.target) {
                      <div class="sla-target">
                        <span class="sla-target-name">{{ targetKey(target) | translate }}</span>
                        <app-sla-countdown
                          [dueAt]="target.due_at"
                          [elapsedPercent]="target.elapsed_percent"
                          [breachedAt]="target.state === 'breached' ? target.due_at : null"
                        />
                      </div>
                    }
                  </td>
                  <td>
                    <button
                      nz-button
                      nzType="link"
                      nzSize="small"
                      type="button"
                      (click)="openTicket.emit(ticket.ticket_id)"
                    >
                      {{ 'HELPDESK_SLA.OPEN_TICKET' | translate }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <nz-empty [nzNotFoundContent]="'HELPDESK_SLA.NO_RISK' | translate" />
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-spin>
      </nz-tab>

      <nz-tab [nzTitle]="'HELPDESK_SLA.TAB_METRICS' | translate">
        <div class="sla-filters">
          <input
            type="date"
            class="sla-date"
            [ngModel]="from()"
            (ngModelChange)="from.set($event)"
            [attr.aria-label]="'HELPDESK_SLA.METRICS_FROM' | translate"
          />
          <input
            type="date"
            class="sla-date"
            [ngModel]="to()"
            (ngModelChange)="to.set($event)"
            [attr.aria-label]="'HELPDESK_SLA.METRICS_TO' | translate"
          />
          <nz-select
            class="sla-filter"
            [ngModel]="store.metricsGroupBy()"
            (ngModelChange)="groupBy($event)"
            [attr.aria-label]="'HELPDESK_SLA.METRICS_GROUP_BY' | translate"
          >
            @for (grouping of groupings; track grouping) {
              <nz-option
                [nzValue]="grouping"
                [nzLabel]="'HELPDESK_SLA.GROUP_' + grouping.toUpperCase() | translate"
              />
            }
          </nz-select>
          <button
            nz-button
            type="button"
            nzType="primary"
            (click)="reloadMetrics()"
            [nzLoading]="store.metricsLoading()"
          >
            {{ 'HELPDESK_SLA.APPLY' | translate }}
          </button>
        </div>

        @if (store.metricsFailed()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'HELPDESK_SLA.LOAD_ERROR' | translate" />
        }

        <nz-spin [nzSpinning]="store.metricsLoading()">
          <nz-table
            #groupsTable
            [nzData]="groups()"
            nzSize="small"
            [nzShowPagination]="false"
            [nzPageSize]="200"
          >
            <thead>
              <tr>
                <th>{{ 'HELPDESK_SLA.COL_GROUP' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_TICKETS' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_MTTFR' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_MTTR' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_FRT_COMPLIANCE' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_RES_COMPLIANCE' | translate }}</th>
                <th>{{ 'HELPDESK_SLA.COL_CSAT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (group of groupsTable.data; track group.key) {
                <tr>
                  <td>{{ group.key }}</td>
                  <td>{{ group.tickets }}</td>
                  <td>{{ group.mttfr_minutes | number: '1.0-0' }}</td>
                  <td>{{ group.mttr_minutes | number: '1.0-0' }}</td>
                  <td>{{ group.first_response_compliance_percent | number: '1.0-1' }}%</td>
                  <td>{{ group.resolution_compliance_percent | number: '1.0-1' }}%</td>
                  <td>
                    @if (group.csat.responses > 0) {
                      {{ group.csat.average | number: '1.1-1' }} ({{ group.csat.responses }})
                    } @else {
                      -
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <nz-empty [nzNotFoundContent]="'HELPDESK_SLA.NO_METRICS' | translate" />
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-spin>
      </nz-tab>
    </nz-tabs>
  `,
  styles: `
    .sla-filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .sla-filter {
      min-width: 160px;
    }
    .sla-date {
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
    }
    .sla-subject {
      color: var(--text-muted);
      font-size: var(--font-size-xs);
    }
    .sla-target {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .sla-target-name {
      min-width: 110px;
      font-size: var(--font-size-xs);
    }
    .sla-row-breached {
      background: var(--status-danger-bg);
    }
  `,
})
export class SlaDashboardComponent implements OnInit {
  protected readonly store = inject(BreachRiskStore);

  /** Emits the id of the ticket the agent wants to open. */
  readonly openTicket = output<string>();

  protected readonly thresholds = RISK_THRESHOLDS;
  protected readonly priorities = PRIORITIES;
  protected readonly statuses = STATUSES;
  protected readonly groupings = GROUPINGS;
  protected readonly from = signal('');
  protected readonly to = signal('');
  private metricsLoaded = false;

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.store.load().subscribe();
  }

  protected changeThreshold(percent: number): void {
    this.store.setFilters({ riskPercent: percent });
    this.reload();
  }

  protected onTab(index: number): void {
    if (index === 1 && !this.metricsLoaded) {
      this.metricsLoaded = true;
      this.reloadMetrics();
    }
  }

  protected groupBy(grouping: MetricsGroupBy): void {
    this.store
      .loadMetrics({
        group_by: grouping,
        from: this.from() || undefined,
        to: this.to() || undefined,
      })
      .subscribe();
  }

  protected reloadMetrics(): void {
    this.store
      .loadMetrics({ from: this.from() || undefined, to: this.to() || undefined })
      .subscribe();
  }

  protected groups(): HelpdeskMetricsGroup[] {
    return this.store.metrics()?.groups ?? [];
  }

  protected isBreached(targets: BreachRiskTarget[]): boolean {
    return targets.some((target) => target.state === 'breached');
  }

  protected targetKey(target: BreachRiskTarget): string {
    return TARGET_LABEL_KEYS[target.target];
  }

  protected colorOf(percent: number): string {
    return riskColor(riskLevel(percent));
  }

  protected priorityColor(priority: string): string {
    return priority === 'critical'
      ? 'error'
      : priority === 'high'
        ? 'warning'
        : priority === 'medium'
          ? 'blue'
          : 'default';
  }
}
