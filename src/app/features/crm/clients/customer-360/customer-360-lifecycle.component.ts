import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import {
  CustomerLifecycleApiService,
  CustomerLifecycleSummary,
  CustomerTimelineEvent,
  TIMELINE_TYPES,
  TimelineType,
} from '@core';
import { TranslatePipe } from '@shared';

/**
 * Cross-module lifecycle of a customer: health, commercial and post-sales KPIs and the filterable timeline of every
 * touchpoint (activities, opportunities, invoices, tickets, field interventions, contracts), with quick actions.
 */
@Component({
  selector: 'app-customer-360-lifecycle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzEmptyModule,
    NzSelectModule,
    NzSkeletonModule,
    NzStatisticModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
  ],
  template: `
    @if (loading()) {
      <nz-skeleton [nzActive]="true" />
    } @else if (summary(); as s) {
      <div class="actions">
        <a nz-button routerLink="/crm/pipeline">{{ 'CRM.CUSTOMER360.LC_NEW_OPPORTUNITY' | translate }}</a>
        <a nz-button routerLink="/field-service/tickets">{{ 'CRM.CUSTOMER360.LC_NEW_TICKET' | translate }}</a>
      </div>

      <div class="kpis">
        <nz-statistic [nzTitle]="'CRM.CUSTOMER360.LC_HEALTH' | translate" [nzValue]="s.health.health_index" />
        <div class="churn">
          <span>{{ 'CRM.CUSTOMER360.LC_CHURN' | translate }}</span>
          <nz-tag [nzColor]="churnColor()">{{ s.health.churn_risk ?? '—' }}</nz-tag>
        </div>
        <nz-statistic [nzTitle]="'CRM.CUSTOMER360.LC_LTV' | translate" [nzValue]="s.kpis.lifetime_value" />
        <nz-statistic [nzTitle]="'CRM.CUSTOMER360.LC_PIPELINE' | translate" [nzValue]="s.kpis.open_pipeline_value" />
        <nz-statistic
          [nzTitle]="'CRM.CUSTOMER360.LC_OVERDUE' | translate"
          [nzValue]="s.kpis.overdue_receivable_amount"
        />
        <nz-statistic [nzTitle]="'CRM.CUSTOMER360.LC_OPEN_TICKETS' | translate" [nzValue]="s.kpis.open_tickets" />
        <nz-statistic
          [nzTitle]="'CRM.CUSTOMER360.LC_SLA_BREACH' | translate"
          [nzValue]="s.kpis.sla_breach_rate"
          nzSuffix="%"
        />
        <nz-statistic [nzTitle]="'CRM.CUSTOMER360.LC_MTTR' | translate" [nzValue]="s.kpis.mttr_hours ?? '—'" />
        <nz-statistic [nzTitle]="'CRM.CUSTOMER360.LC_CONTRACTS' | translate" [nzValue]="s.kpis.active_contracts" />
        <div class="churn">
          <span>{{ 'CRM.CUSTOMER360.LC_COVERAGE' | translate }}</span>
          <nz-tag>{{ coverageKey() | translate }}</nz-tag>
        </div>
        <nz-statistic
          [nzTitle]="'CRM.CUSTOMER360.LC_HOURS_REMAINING' | translate"
          [nzValue]="s.kpis.contract_hours_remaining"
        />
        <nz-statistic
          [nzTitle]="'CRM.CUSTOMER360.LC_INTERVENTIONS_OPEN' | translate"
          [nzValue]="s.kpis.interventions_scheduled"
        />
        <nz-statistic
          [nzTitle]="'CRM.CUSTOMER360.LC_INTERVENTIONS_DONE' | translate"
          [nzValue]="s.kpis.interventions_completed"
        />
      </div>

      <h4>{{ 'CRM.CUSTOMER360.LC_TIMELINE' | translate }}</h4>
      <nz-select
        class="filter"
        nzMode="multiple"
        [ngModel]="selectedTypes()"
        (ngModelChange)="applyFilter($event)"
        [nzPlaceHolder]="'CRM.CUSTOMER360.LC_FILTER' | translate"
      >
        @for (type of types; track type) {
          <nz-option [nzValue]="type" [nzLabel]="typeKey(type) | translate" />
        }
      </nz-select>

      <nz-timeline>
        @for (event of events(); track event.type + event.id) {
          <nz-timeline-item>
            <nz-tag>{{ typeKey(event.type) | translate }}</nz-tag>
            <strong>{{ event.title }}</strong>
            @if (event.status) {
              <nz-tag>{{ event.status }}</nz-tag>
            }
            @if (event.amount) {
              <span>{{ event.amount }}</span>
            }
            <span class="when">{{ event.occurred_at | date: 'medium' }}</span>
          </nz-timeline-item>
        } @empty {
          <nz-empty />
        }
      </nz-timeline>
    } @else {
      <nz-empty [nzNotFoundContent]="'CRM.CUSTOMER360.LC_NO_ACCOUNT' | translate" />
    }
  `,
  styles: `
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .churn {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter {
      min-width: 280px;
      margin-bottom: 12px;
    }
    .when {
      margin-left: 8px;
      opacity: 0.6;
    }
  `,
})
export class Customer360LifecycleComponent implements OnInit {
  private readonly api = inject(CustomerLifecycleApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly contactId = input.required<string>();

  protected readonly types = TIMELINE_TYPES;
  protected readonly loading = signal(true);
  protected readonly summary = signal<CustomerLifecycleSummary | null>(null);
  protected readonly events = signal<CustomerTimelineEvent[]>([]);
  protected readonly selectedTypes = signal<TimelineType[]>([]);

  protected readonly churnColor = computed(() => {
    switch (this.summary()?.health.churn_risk) {
      case 'critical':
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      default:
        return 'green';
    }
  });

  protected readonly coverageKey = computed(
    () => `CRM.CUSTOMER360.LC_COVERAGE_${(this.summary()?.kpis.contract_coverage ?? 'none').toUpperCase()}`,
  );

  private accountId: string | null = null;

  ngOnInit(): void {
    this.api
      .accountIdForContact(this.contactId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accountId) => {
          this.accountId = accountId;
          if (accountId === null) {
            this.loading.set(false);
            return;
          }
          this.api
            .summary(accountId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (summary) => {
                this.summary.set(summary);
                this.loading.set(false);
              },
              error: () => this.loading.set(false),
            });
          this.loadTimeline();
        },
        error: () => this.loading.set(false),
      });
  }

  protected applyFilter(types: TimelineType[]): void {
    this.selectedTypes.set(types);
    this.loadTimeline();
  }

  protected typeKey(type: TimelineType): string {
    return `CRM.CUSTOMER360.LC_TYPE_${type.toUpperCase()}`;
  }

  private loadTimeline(): void {
    if (this.accountId === null) {
      return;
    }
    this.api
      .timeline(this.accountId, this.selectedTypes())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((events) => this.events.set(events));
  }
}
